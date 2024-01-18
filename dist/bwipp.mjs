// This file is part of the bwip-js project available at:
//
// 	  http://metafloor.github.io/bwip-js
//
// Copyright (c) 2011-2024 Mark Warren
//
// This file contains code automatically generated from:
// Barcode Writer in Pure PostScript - Version 2023-04-03
// Copyright (c) 2004-2023 Terry Burton
//
// The MIT License
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
//
"use strict";

// bwip-js // Barcode Writer in Pure JavaScript
// https://github.com/metafloor/bwip-js
//
// This code was automatically generated from:
// Barcode Writer in Pure PostScript - Version 2023-04-03
//
// Copyright (c) 2011-2024 Mark Warren
// Copyright (c) 2004-2023 Terry Burton
//
// Licensed MIT. See the LICENSE file in the bwip-js root directory.
// bwip-js/barcode-hdr.js
//
// This code is injected above the cross-compiled barcode.js.

// The BWIPJS object (graphics interface)
var $$ = null;
var $j = 0; // stack pointer
var $k = []; // operand stack
var $_ = {}; // base of the dictionary stack

// Array ctor
//	$a()	: Build a new array up to the Infinity-marker on the stack.
//	$a(arr)	: Convert native array to a "view" of the array.
//	$a(len)	: Create a new array of length `len`
function $a(a) {
    if (!arguments.length) {
      for (var i = $j - 1; i >= 0 && $k[i] !== Infinity; i--);
      if (i < 0) {
        throw new Error("array-marker-not-found");
      }
      a = $k.splice(i + 1, $j - 1 - i);
      $j = i;
    } else if (!(a instanceof Array)) {
      a = new Array(+arguments[0]);
      for (var i = 0, l = a.length; i < l; i++) {
        a[i] = null;
      }
    }
    return new ArrayView(a, 0, a.length);
  }
  
  function $geti(s, o, l) {
      if (s instanceof ArrayView) {
          return new ArrayView(s.b, s.o + o, l);
      }
      if (s instanceof Uint8Array) {
          return s.subarray(o, o + l);
      }
      // Must be a string
      return s.substr(o, l);
  }
  
  class ArrayView {
    constructor(base, offset, length) {
      this.b = base;
      this.o = offset;
      this.length = length;
    }
  
    getRawArray() {
      if (this.o === 0 && this.length === this.b.length) return this.b;
      return this.b.slice(this.o, this.o + this.length);
    }
  }

// dict ctor
//	$d() : look for the Infinity marker on the stack
function $d() {
    // Build the dictionary in the order the keys/values were pushed so enumeration
    // occurs in the correct sequence.
    for (var mark = $j - 1; mark >= 0 && $k[mark] !== Infinity; mark -= 2) {
        if ($k[mark - 1] === Infinity) {
            throw new Error('dict-malformed-stack');
        }
    }
    if (mark < 0) {
        throw new Error('dict-marker-not-found');
    }
    var d = new Map;
    for (var i = mark + 1; i < $j; i += 2) {
        // Unlike javascript, postscript dict keys differentiate between
        // numbers and the string representation of a number.
        var k = $k[i]; // "key" into the dict entry
        var t = typeof k;
        if (t == 'number' || t == 'string') {
            d.set(k, $k[i + 1]);
        } else if (k instanceof Uint8Array) {
            d.set($z(k), $k[i + 1]);
        } else {
            throw new Error('dict-not-a-valid-key(' + k + ')');
        }
    }
    $j = mark;
    $k = $k.slice(0, mark)
    return d;
}

// string ctor
//	s(number)	: create zero-filled string of number-length
//	s(string)	: make a copy of the string
//	s(uint8[])	: make a copy of the string
//
// Returns a Uint8Array-string.
function $s(v) {
    var t = typeof v;
    if (t === 'number') {
        return new Uint8Array(v);
    }
    if (t !== 'string') {
        v = '' + v;
    }
    var s = new Uint8Array(v.length);
    for (var i = 0; i < v.length; i++) {
        s[i] = v.charCodeAt(i);
    }
    return s;
}

// ... n c roll
function $r(n, c) {
    if ($j < n) {
        throw new Error('roll: --stack-underflow--');
    }
    if (!c) {
        return;
    }
    if (c < 0) {
        var t = $k.splice($j - n, -c);
    } else {
        var t = $k.splice($j - n, n - c);
    }
    $k.splice.apply($k, [$j - t.length, 0].concat(t));
}

// Primarily designed to convert uint8-string to string, but will call the
// the toString() method on any value.
function $z(s) {
    if (s instanceof Uint8Array) {
        return String.fromCharCode.apply(null, s);
    }
    return '' + s;
}

// Copies source to dest and returns a view of just the copied characters
function $strcpy(dst, src) {
    if (typeof dst === 'string') {
        dst = $s(dst);
    }
    if (src instanceof Uint8Array) {
        for (var i = 0, l = src.length; i < l; i++) {
            dst[i] = src[i];
        }
    } else {
        for (var i = 0, l = src.length; i < l; i++) {
            dst[i] = src.charCodeAt(i);
        }
    }
    return src.length < dst.length ? dst.subarray(0, src.length) : dst;
}

// Copies source to dest and should (but doesn't) return a view of just the copied elements
function $arrcpy(dst, src) {
    for (var i = 0, l = src.length; i < l; i++) {
        dst[i] = src[i];
    }
    dst.length = src.length;
    return dst;
}

// cvs operator - convert a value to its string representation
//	s : string to store into
//	v : any value
function $cvs(s, v) {
    var t = typeof v;
    if (t == 'number' || t == 'boolean' || v === null) {
        v = '' + v;
    } else if (t !== 'string') {
        v = '--nostringval--';
    }
    for (var i = 0, l = v.length; i < l; i++) {
        s[i] = v.charCodeAt(i);
    }
    $k[$j++] = i < s.length ? s.subarray(0, i) : s;
}
// cvi operator - converts a numeric string value to integer.
function $cvi(s) {
    if (s instanceof Uint8Array) {
        // nul-chars on the end of a string are ignored by postscript but cause javascript
        // to return a zero result.
        return String.fromCharCode.apply(null, s).replace(/\0+$/, '') | 0;
    }
    return ('' + s) | 0;
}

// cvrs operator - convert a number to a radix string
//	s : string to store into
//	n : number
//	r : radix
function $cvrs(s, n, r) {
    return $strcpy(s, (~~n).toString(r).toUpperCase());
}

// cvx - convert to executable.
// This is only used by BWIPP to convert <XX> string literals.
function $cvx(s) {
    s = $z(s)
    var m = /^\s*<((?:[0-9a-fA-F]{2})+)>\s*$/.exec(s);
    if (!m) {
        throw new Error('cvx: not a <HH> hex string literal');
    }
    var h = m[1];
    var l = h.length >> 1;
    var u = new Uint8Array(l);
    for (var i = 0, j = 0; i < l; i++) {
        var c0 = h.charCodeAt(j++);
        var c1 = h.charCodeAt(j++);
        u[i] = ((c0 < 58 ? c0 - 48 : (c0 & 15) + 9) << 4) +
            (c1 < 58 ? c1 - 48 : (c1 & 15) + 9);
    }
    return u;
}

// get operator
//	s : source
//	k : key
function $get(s, k) {
    if (s instanceof ArrayView) {
        return s.b[s.o + k];
    }
    if (s instanceof Uint8Array) {
        return s[k];
    }
    if (typeof s === 'string') {
        return s.charCodeAt(k);
    }
    if (k instanceof Uint8Array) {
        return s.get($z(k));
    }
    return s.get(k);
}

// put operator
//	d : dest
//	k : key
//	v : value
function $put(d, k, v) {
    if (d instanceof ArrayView) {
        d.b[d.o + k] = v;
    } else if (d instanceof Uint8Array) {
        d[k] = v;
    } else if (typeof d == 'object') {
        if (k instanceof Uint8Array) {
            d.set($z(k), v);
        } else {
            d.set(k, v);
        }
    } else {
        throw new Error('put-not-writable-' + (typeof d));
    }
}

// putinterval operator
//	d : dst
//	o : offset
//	s : src
function $puti(d, o, s) {
    if (d instanceof ArrayView) {
        // Operate on the base arrays
        var darr = d.b;
        var doff = o + d.o;
        var sarr = s.b;
        var soff = s.o;

        for (var i = 0, l = s.length; i < l; i++) {
            darr[doff + i] = sarr[soff + i];
        }
    } else if (d instanceof Uint8Array) {
        if (typeof s == 'string') {
            for (var i = 0, l = s.length; i < l; i++) {
                d[o + i] = s.charCodeAt(i);
            }
        } else {
            // When both d and s are the same, we want to copy
            // backwards, which works for the general case as well.
            for (var i = s.length - 1; i >= 0; i--) {
                d[o + i] = s[i];
            }
        }
    } else {
        throw new Error('putinterval-not-writable-' + (typeof d));
    }
}

// type operator
function $type(v) {
    // null can be mis-typed - get it out of the way
    if (v == null) {
        return 'nulltype';
    }
    var t = typeof v;
    if (t == 'number') {
        return v % 1 ? 'realtype' : 'integertype';
    }
    if (t == 'boolean') {
        return 'booleantype';
    }
    if (t == 'string' || v instanceof Uint8Array) {
        return 'stringtype';
    }
    if (t == 'function') {
        return 'operatortype';
    }
    if (v instanceof ArrayView) {
        return 'arraytype';
    }
    return 'dicttype';
    // filetype
    // fonttype
    // gstatetype
    // marktype	(v === Infinity)
    // nametype
    // savetype
}

// anchorsearch operator
//		string seek anchorsearch suffix seek true %if-found
//						         string false	  %if-not-found
function $anchorsearch(str, seek) {
    if (!(str instanceof Uint8Array)) {
        str = $s(str);
    }
    var i = 0,
        ls = str.length,
        lk = seek.length;

    // Optimize for single characters.
    if (lk == 1) {
        var cd = seek instanceof Uint8Array ? seek[0] : seek.charCodeAt(0);
        i = str[0] == cd ? 1 : ls;
    } else if (seek.length <= ls) {
        // Slow path, 
        if (!(seek instanceof Uint8Array)) {
            seek = $s(seek);
        }
        for (; i < lk && str[i] == seek[i]; i++);
    }
    if (i == lk) {
        $k[$j++] = str.subarray(lk);
        $k[$j++] = str.subarray(0, lk);
        $k[$j++] = true;
    } else {
        $k[$j++] = str;
        $k[$j++] = false;
    }
}

// search operator
//		string seek search suffix match prefix true %if-found
//						   string false				%if-not-found
function $search(str, seek) {
    if (!(str instanceof Uint8Array)) {
        str = $s(str);
    }
    var ls = str.length;

    // Virtually all uses of search in BWIPP are for single-characters.
    // Optimize for that case.
    if (seek.length == 1) {
        var lk = 1;
        var cd = seek instanceof Uint8Array ? seek[0] : seek.charCodeAt(0);
        for (var i = 0; i < ls && str[i] != cd; i++);
    } else {
        // Slow path, 
        if (!(seek instanceof Uint8Array)) {
            seek = $s(seek);
        }
        var lk = seek.length;
        var cd = seek[0];
        for (var i = 0; i < ls && str[i] != cd; i++);
        while (i < ls) {
            for (var j = 1; j < lk && str[i + j] === seek[j]; j++);
            if (j === lk) {
                break;
            }
            for (i++; i < ls && str[i] != cd; i++);
        }
    }
    if (i < ls) {
        $k[$j++] = str.subarray(i + lk);
        $k[$j++] = str.subarray(i, i + lk);
        $k[$j++] = str.subarray(0, i);
        $k[$j++] = true;
    } else {
        $k[$j++] = str;
        $k[$j++] = false;
    }
}

// The callback is omitted when forall is being used just to push onto the
// stack.  The callback normally returns undefined.  A return of true means break.
function $forall(o, cb) {
    if (o instanceof ArrayView) {
        // The array may be a view.
        for (var a = o.b, i = o.o, l = o.o + o.length; i < l; i++) {
            $k[$j++] = a[i];
            if (cb && cb()) break;
        }
    } else if (o instanceof Uint8Array) {
        for (var i = 0, l = o.length; i < l; i++) {
            $k[$j++] = o[i];
            if (cb && cb()) break;
        }
    } else if (typeof o === 'string') {
        for (var i = 0, l = o.length; i < l; i++) {
            $k[$j++] = o.charCodeAt(i);
            if (cb && cb()) break;
        }
    } else if (o instanceof Map) {
        for (var keys = o.keys(), i = 0, l = o.size; i < l; i++) {
            var id = keys.next().value;
            $k[$j++] = id;
            $k[$j++] = o.get(id);
            if (cb && cb()) break;
        }
    } else {
        for (var id in o) {
            $k[$j++] = id;
            $k[$j++] = o[id];
            if (cb && cb()) break;
        }
    }
}

function $cleartomark() {
    while ($j > 0 && $k[--$j] !== Infinity);
}

function $counttomark() {
    for (var i = $j - 1; i >= 0 && $k[i] !== Infinity; i--);
    return $j - i - 1;
}

function $aload(a) {
    for (var i = 0, l = a.length, b = a.b, o = a.o; i < l; i++) {
        $k[$j++] = b[o + i];
    }
    // This push has been optimized out.  See $.aload() in psc.js.
    //$k[$j++] = a;
}

function $astore(a) {
    for (var i = 0, l = a.length, b = a.b, o = a.o + l - 1; i < l; i++) {
        b[o - i] = $k[--$j];
    }
    $k[$j++] = a;
}

function $eq(a, b) {
    if (typeof a === "string" && typeof b === "string") {
      return a == b;
    }
    if (a instanceof Uint8Array && b instanceof Uint8Array) {
      if (a.length != b.length) {
        return false;
      }
      for (var i = 0, l = a.length; i < l; i++) {
        if (a[i] != b[i]) {
          return false;
        }
      }
      return true;
    }
    if (
      (a instanceof Uint8Array && typeof b === "string") ||
      (b instanceof Uint8Array && typeof a === "string")
    ) {
      if (a.length != b.length) {
        return false;
      }
      //   console.log("cmp", a, b);
      if (a instanceof Uint8Array) {
        for (var i = 0, l = a.length; i < l; i++) {
          if (a[i] != b.charCodeAt(i)) {
            return false;
          }
        }
      } else {
        for (var i = 0, l = a.length; i < l; i++) {
          if (a.charCodeAt(i) != b[i]) {
            return false;
          }
        }
      }
      return true;
    }
    return a == b;
  }

function $aload_it(a) {
    if (a.o === 0 && a.b.length === a.length) return a.b;
    return a.b.slice(a.o, a.o+a.length)
}

function $forall_it(o) {
    if (o instanceof ArrayView) {
        // return o.getRawArray();
        if (o.o === 0 && o.b.length === o.length) return o.b;
        return o.b.slice(o.o, o.o+o.length)
    } 
    return $forall_it_2(o);
}

function $forall_it_2(o) {
    if (o instanceof Uint8Array) {
        return o;
    } else if (typeof o === 'string') {
        return o
    }
    return $forall_it_3(o);
}

function* $forall_it_3(o) {
    if (o instanceof Map) {
        for (var keys = o.keys(), i = 0, l = o.size; i < l; i++) {
            var id = keys.next().value;
            // yield id;
            $k[$j++] = id;
            yield o.get(id);
        }
    } else {
        for (var id in o) {
            // yield id;
            $k[$j++] = id;
            yield o[id];
        }
    }
}

// function* $aload_it(a) {
//     const o = a.o;
//     const lim = a.o + a.length;
//     for (let i=o; i<lim; ++i) {
//         yield a.b[i];
//     }
// }

// function* $forall_it(o) {
//     if (o instanceof ArrayView) {
//         // The array may be a view.
//         for (var a = o.b, i = o.o, l = o.o + o.length; i < l; i++) {
//             yield a[i];
//         }
//     } else if (o instanceof Uint8Array) {
//         for (var i = 0, l = o.length; i < l; i++) {
//             yield o[i];
//         }
//     } else if (typeof o === 'string') {
//         for (var i = 0, l = o.length; i < l; i++) {
//             yield o.charCodeAt(i);
//         }
//     } else if (o instanceof Map) {
//         for (var keys = o.keys(), i = 0, l = o.size; i < l; i++) {
//             var id = keys.next().value;
//             // yield id;
//             $k[$j++] = id;
//             yield o.get(id);
//         }
//     } else {
//         for (var id in o) {
//             // yield id;
//             $k[$j++] = id;
//             yield o[id];
//         }
//     }
// }

function $ne(a, b) {
    return !$eq(a, b);
}

function $lt(a, b) {
    if (a instanceof Uint8Array) {
        a = $z(a);
    }
    if (b instanceof Uint8Array) {
        b = $z(b);
    }
    return a < b;
}

function $le(a, b) {
    if (a instanceof Uint8Array) {
        a = $z(a);
    }
    if (b instanceof Uint8Array) {
        b = $z(b);
    }
    return a <= b;
}

function $gt(a, b) {
    if (a instanceof Uint8Array) {
        a = $z(a);
    }
    if (b instanceof Uint8Array) {
        b = $z(b);
    }
    return a > b;
}

function $ge(a, b) {
    if (a instanceof Uint8Array) {
        a = $z(a);
    }
    if (b instanceof Uint8Array) {
        b = $z(b);
    }
    return a >= b;
}

function $an(a, b) { // and
    return (typeof a === 'boolean') ? a && b : a & b;
}

function $or(a, b) { // or
    return (typeof a === 'boolean') ? a || b : a | b;
}

function $xo(a, b) { // xor
    return (typeof a === 'boolean') ? !a && b || a && !b : a ^ b;
}

function $nt(a) {
    return typeof a == 'boolean' ? !a : ~a;
}
// emulate single-precision floating-point (pseudo-polyfill for Math.fround)
var $f = (function(fa) {
    return function(v) {
        return Number.isInteger(v) ? v : (fa[0] = v, fa[0]);
    };
})(new Float32Array(1));

// This is a replacement for the BWIPP raiseerror function.
function bwipp_raiseerror() {
    var info = $k[--$j];
    var name = $k[--$j];
    throw new Error($z(name) + ": " + $z(info));
}

// This is a replacement for the BWIPP processoptions function.
// We cannot use the BWIPP version due to two reasons:
// - legacy code allows strings to be numbers and numbers to be strings
// - in javascript, there is no way to tell the difference between a real
//   number that is an integer, and an actual integer.
//
// options currentdict processoptions exec -> options
function bwipp_processoptions() {
    var dict = $k[--$j];
    var opts = $k[$j - 1];
    var map = opts instanceof Map;
    for (var id in dict) {
        var val;
        if (map) {
            if (!opts.has(id)) {
                continue;
            }
            val = opts.get(id);
        } else {
            if (!opts.hasOwnProperty(id)) {
                continue;
            }
            val = opts[id];
        }
        var def = dict[id];
        var typ = typeof def;

        // null is a placeholder for realtype
        if (def == null || typ == 'number') {
            // This allows for numeric strings
            if (!isFinite(+val)) {
                throw new Error('bwipp.invalidOptionType: ' + id +
                    ': not a realtype: ' + val);
            }
            if (typeof val == 'string') {
                val = +val;
                map ? opts.set(id, val) : (opts[id] = val);
            }
        } else if (typ == 'boolean') {
            if (val !== true && val !== false) {
                // In keeping with the ethos of javascript, allow a more relaxed
                // interpretation of boolean.
                if (val == null || (val | 0) === val) {
                    val = !!val;
                } else if (val == 'true') {
                    val = true;
                } else if (val == 'false') {
                    val = false;
                } else {
                    throw new Error('bwipp.invalidOptionType: ' + id +
                        ': not a booleantype: ' + val);
                }
                map ? opts.set(id, val) : (opts[id] = val);
            }
        } else if (typ == 'string' || def instanceof Uint8Array) {
            // This allows numbers to be strings
            if (typeof val == 'number') {
                val = '' + val;
                map ? opts.set(id, val) : (opts[id] = val);
            } else if (typeof val != 'string' && !(val instanceof Uint8Array)) {
                throw new Error('bwipp.invalidOptionType: ' + id +
                    ': not a stringtype: ' + val);
            }
        }
        // Set the option into the dictionary
        dict[id] = val;
    }
}

// Replacement for loadctx which contains complex postscript operations
// that we don't implement correctly.
// f is a reference to the enclosing function.
function bwipp_loadctx(f) {
    if (!f.$ctx) {
        f.$ctx = {};
    }
    var next = Object.getPrototypeOf($_);
    Object.setPrototypeOf(f.$ctx, next);
    Object.setPrototypeOf($_, f.$ctx);
}

function bwipp_parseinput() {
    $_ = Object.create($_); //#200
    bwipp_loadctx(bwipp_parseinput) //#202
    $_.fncvals = $k[--$j]; //#204
    $_.barcode = $k[--$j]; //#205
    var _2 = 'parse'; //#207
    $_[_2] = $get($_.fncvals, _2); //#207
    delete $_.fncvals[_2]; //#207
    var _6 = 'parsefnc'; //#208
    $_[_6] = $get($_.fncvals, _6); //#208
    delete $_.fncvals[_6]; //#208
    var _A = 'parseonly'; //#209
    var _C = $get($_.fncvals, _A) !== undefined; //#209
    $_[_A] = _C; //#209
    delete $_.fncvals[_A]; //#209
    var _E = 'eci'; //#210
    var _G = $get($_.fncvals, _E) !== undefined; //#210
    $_[_E] = _G; //#210
    delete $_.fncvals[_E]; //#210
    if (!bwipp_parseinput.__225__) { //#225
        $_ = Object.create($_); //#225
        $k[$j++] = Infinity; //#223
        var _I = $a(['NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL', 'BS', 'TAB', 'LF', 'VT', 'FF', 'CR', "", "", 'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB', 'CAN', 'EM', 'SUB', 'ESC', 'FS', 'GS', 'RS', 'US']); //#219
        $k[$j++] = 0; //#223
        for (var _J = 0, _K = _I.length; _J < _K; _J++) { //#223
            var _M = $k[--$j]; //#222
            $k[$j++] = $get(_I, _J); //#222
            $k[$j++] = _M; //#222
            $k[$j++] = $f(_M + 1); //#222
        } //#222
        $j--; //#223
        $_.ctrl = $d(); //#224
        for (var id in $_) $_.hasOwnProperty(id) && (bwipp_parseinput.$ctx[id] = $_[id]); //#224
        bwipp_parseinput.__225__ = 1; //#224
        $_ = Object.getPrototypeOf($_); //#224
    } //#224
    $_.msg = $a($_.barcode.length); //#227
    $_.j = 0; //#228
    $k[$j++] = $_.barcode; //#347
    for (;;) { //#347
        $search($k[--$j], "^"); //#230
        var _T = $k[--$j]; //#230
        var _U = $k[--$j]; //#230
        $k[$j++] = _T; //#233
        $k[$j++] = _U.length; //#233
        $k[$j++] = $_.msg; //#233
        $k[$j++] = $_.j; //#233
        $k[$j++] = _U; //#233
        $k[$j++] = Infinity; //#233
        var _X = $k[--$j]; //#233
        var _Y = $k[--$j]; //#233
        $k[$j++] = _X; //#233
        $forall(_Y); //#233
        var _Z = $a(); //#233
        var _a = $k[--$j]; //#233
        $puti($k[--$j], _a, _Z); //#233
        $_.j = $f($k[--$j] + $_.j); //#234
        if ($k[--$j]) { //#345
            $j--; //#236
            for (var _f = 0, _g = 1; _f < _g; _f++) { //#343
                if ($an($nt($_.parse), $nt($_.parsefnc))) { //#243
                    $put($_.msg, $_.j, 94); //#240
                    $_.j = $f($_.j + 1); //#241
                    break; //#242
                } //#242
                $put($_.msg, $_.j, 94); //#246
                $_.j = $f($_.j + 1); //#247
                if ($_.parse) { //#290
                    var _q = $k[--$j]; //#251
                    $k[$j++] = _q; //#262
                    if (_q.length >= 3) { //#262
                        var _r = $k[--$j]; //#252
                        var _s = $geti(_r, 0, 3); //#252
                        var _t = $_.ctrl; //#252
                        var _u = $get(_t, _s) !== undefined; //#253
                        $k[$j++] = _r; //#261
                        $k[$j++] = _t; //#261
                        $k[$j++] = _s; //#261
                        if (_u) { //#260
                            $_.j = $f($_.j - 1); //#254
                            var _w = $k[--$j]; //#255
                            $put($_.msg, $_.j, $get($k[--$j], _w)); //#255
                            $_.j = $f($_.j + 1); //#256
                            var _12 = $k[--$j]; //#257
                            $k[$j++] = $geti(_12, 3, _12.length - 3); //#258
                            break; //#258
                        } else { //#260
                            $j -= 2; //#260
                        } //#260
                    } //#260
                    var _14 = $k[--$j]; //#263
                    $k[$j++] = _14; //#274
                    if (_14.length >= 2) { //#274
                        var _15 = $k[--$j]; //#264
                        var _16 = $geti(_15, 0, 2); //#264
                        var _17 = $_.ctrl; //#264
                        var _18 = $get(_17, _16) !== undefined; //#265
                        $k[$j++] = _15; //#273
                        $k[$j++] = _17; //#273
                        $k[$j++] = _16; //#273
                        if (_18) { //#272
                            $_.j = $f($_.j - 1); //#266
                            var _1A = $k[--$j]; //#267
                            $put($_.msg, $_.j, $get($k[--$j], _1A)); //#267
                            $_.j = $f($_.j + 1); //#268
                            var _1G = $k[--$j]; //#269
                            $k[$j++] = $geti(_1G, 2, _1G.length - 2); //#270
                            break; //#270
                        } else { //#272
                            $j -= 2; //#272
                        } //#272
                    } //#272
                    var _1I = $k[--$j]; //#275
                    $k[$j++] = _1I; //#289
                    if (_1I.length >= 3) { //#289
                        var _1J = $k[--$j]; //#276
                        var _1K = $geti(_1J, 0, 3); //#276
                        $k[$j++] = _1J; //#278
                        $k[$j++] = true; //#278
                        for (var _1L = 0, _1M = _1K.length; _1L < _1M; _1L++) { //#278
                            var _1N = $get(_1K, _1L); //#278
                            if ((_1N < 48) || (_1N > 57)) { //#277
                                $j--; //#277
                                $k[$j++] = false; //#277
                            } //#277
                        } //#277
                        if ($k[--$j]) { //#288
                            var _1P = $k[--$j]; //#280
                            var _1R = $cvi($geti(_1P, 0, 3)); //#280
                            $k[$j++] = _1P; //#283
                            $k[$j++] = _1R; //#283
                            if (_1R > 255) { //#283
                                $j -= 2; //#281
                                $k[$j++] = 'bwipp.invalidOrdinal#282'; //#282
                                $k[$j++] = "Ordinal must be 000 to 255"; //#282
                                bwipp_raiseerror(); //#282
                            } //#282
                            $_.j = $f($_.j - 1); //#284
                            $put($_.msg, $_.j, $k[--$j]); //#285
                            $_.j = $f($_.j + 1); //#286
                            var _1X = $k[--$j]; //#287
                            $k[$j++] = $geti(_1X, 3, _1X.length - 3); //#287
                        } //#287
                    } //#287
                } //#287
                if (($or($_.parseonly, $nt($_.parsefnc))) || ($get($_.msg, $f($_.j - 1)) != 94)) { //#295
                    break; //#295
                } //#295
                $_.j = $f($_.j - 1); //#298
                var _1f = $k[--$j]; //#299
                $k[$j++] = _1f; //#302
                if (_1f.length < 3) { //#302
                    $j--; //#300
                    $k[$j++] = 'bwipp.truncatedFNC#301'; //#301
                    $k[$j++] = "Function character truncated"; //#301
                    bwipp_raiseerror(); //#301
                } //#301
                var _1g = $k[--$j]; //#303
                $k[$j++] = _1g; //#308
                if ($get(_1g, 0) == 94) { //#308
                    $put($_.msg, $_.j, 94); //#304
                    $_.j = $f($_.j + 1); //#305
                    var _1l = $k[--$j]; //#306
                    $k[$j++] = $geti(_1l, 1, _1l.length - 1); //#307
                    break; //#307
                } //#307
                var _1n = $k[--$j]; //#309
                $k[$j++] = _1n; //#326
                if ($eq($geti(_1n, 0, 3), "ECI") && $_.eci) { //#326
                    var _1q = $k[--$j]; //#310
                    $k[$j++] = _1q; //#313
                    if (_1q.length < 9) { //#313
                        $j--; //#311
                        $k[$j++] = 'bwipp.truncatedECI#312'; //#312
                        $k[$j++] = "ECI truncated"; //#312
                        bwipp_raiseerror(); //#312
                    } //#312
                    var _1r = $k[--$j]; //#314
                    var _1s = $geti(_1r, 3, 6); //#314
                    $k[$j++] = _1r; //#320
                    $k[$j++] = _1s; //#320
                    for (var _1t = 0, _1u = _1s.length; _1t < _1u; _1t++) { //#320
                        var _1v = $get(_1s, _1t); //#320
                        if ((_1v < 48) || (_1v > 57)) { //#319
                            $j -= 2; //#317
                            $k[$j++] = 'bwipp.invalidECI#318'; //#318
                            $k[$j++] = "ECI must be 000000 to 999999"; //#318
                            bwipp_raiseerror(); //#318
                        } //#318
                    } //#318
                    var _1w = $k[--$j]; //#321
                    $k[$j++] = 0; //#321
                    $forall(_1w, function() { //#321
                        var _1x = $k[--$j]; //#321
                        var _1y = $k[--$j]; //#321
                        $k[$j++] = ($f(_1y - $f(_1x - 48))) * 10; //#321
                    }); //#321
                    $put($_.msg, $_.j, (~~($k[--$j] / 10)) - 1000000); //#322
                    $_.j = $f($_.j + 1); //#323
                    var _23 = $k[--$j]; //#324
                    $k[$j++] = $geti(_23, 9, _23.length - 9); //#325
                    break; //#325
                } //#325
                var _25 = $k[--$j]; //#327
                $k[$j++] = _25; //#330
                if (_25.length < 4) { //#330
                    $j--; //#328
                    $k[$j++] = 'bwipp.truncatedFNC#329'; //#329
                    $k[$j++] = "Function character truncated"; //#329
                    bwipp_raiseerror(); //#329
                } //#329
                var _26 = $k[--$j]; //#331
                var _27 = $geti(_26, 0, 4); //#331
                var _29 = $get($_.fncvals, _27) !== undefined; //#331
                $k[$j++] = _26; //#336
                $k[$j++] = _27; //#336
                if (!_29) { //#336
                    var _2A = $k[--$j]; //#332
                    var _2B = $s(_2A.length + 28); //#332
                    $puti(_2B, 28, _2A); //#332
                    $puti(_2B, 0, "Unknown function character: "); //#333
                    var _2C = $k[--$j]; //#334
                    $k[$j++] = _2B; //#334
                    $k[$j++] = _2C; //#334
                    $j--; //#334
                    var _2D = $k[--$j]; //#335
                    $k[$j++] = 'bwipp.unknownFNC#335'; //#335
                    $k[$j++] = _2D; //#335
                    bwipp_raiseerror(); //#335
                } //#335
                $put($_.msg, $_.j, $get($_.fncvals, $k[--$j])); //#338
                $_.j = $f($_.j + 1); //#339
                var _2K = $k[--$j]; //#340
                $k[$j++] = $geti(_2K, 4, _2K.length - 4); //#341
                break; //#341
            } //#341
        } else { //#345
            break; //#345
        } //#345
    } //#345
    if ($nt($_.parseonly)) { //#353
        $k[$j++] = $geti($_.msg, 0, $_.j); //#350
    } else { //#353
        $k[$j++] = $s($_.j); //#353
        for (var _2U = 0, _2T = $f($_.j - 1); _2U <= _2T; _2U += 1) { //#353
            var _2V = $k[--$j]; //#353
            $put(_2V, _2U, $get($_.msg, _2U)); //#353
            $k[$j++] = _2V; //#353
        } //#353
    } //#353
    $_ = Object.getPrototypeOf($_); //#356
    $_ = Object.getPrototypeOf($_); //#358
}

function bwipp_renmatrix() {
    if ($_.bwipjs_dontdraw) { //#3569
        return; //#3569
    } //#3569
    $_ = Object.create($_); //#3571
    $_.width = 1; //#3574
    $_.height = 1; //#3575
    $_.barcolor = "unset"; //#3576
    $_.backgroundcolor = "unset"; //#3577
    $_.colormap = "unset"; //#3578
    $_.dotty = false; //#3579
    $_.inkspread = 0; //#3580
    $_.inkspreadh = 0; //#3581
    $_.inkspreadv = 0; //#3582
    $_.includetext = false; //#3583
    $_.txt = $a([]); //#3584
    $_.textcolor = "unset"; //#3585
    $_.textxalign = "unset"; //#3586
    $_.textyalign = "unset"; //#3587
    $_.textfont = "OCR-B"; //#3588
    $_.textsize = 10; //#3589
    $_.textxoffset = 0; //#3590
    $_.textyoffset = 0; //#3591
    $_.textgaps = 0; //#3592
    $_.alttext = ""; //#3593
    $forall($k[--$j], function() { //#3595
        var _3 = $k[--$j]; //#3595
        $_[$k[--$j]] = _3; //#3595
    }); //#3595
    $k[$j++] = $_.opt; //#3596
    delete $_['opt']; //#3596
    $k[$j++] = $_; //#3596
    bwipp_processoptions(); //#3596
    $j--; //#3596
    if ($_.inkspread != 0) { //#3598
        $_.inkspreadh = $_.inkspread; //#3598
    } //#3598
    if ($_.inkspread != 0) { //#3599
        $_.inkspreadv = $_.inkspread; //#3599
    } //#3599
    if ($_.textsize <= 0) { //#3603
        $k[$j++] = 'bwipp.renmatrixBadTextsize#3602'; //#3602
        $k[$j++] = "The font size must be greater than zero"; //#3602
        bwipp_raiseerror(); //#3602
    } //#3602
    $_.xyget = function() {
        var _C = $k[--$j]; //#3605
        var _F = $get($_.pixs, $f($k[--$j] + (_C * $_.pixx))); //#3605
        $k[$j++] = _F; //#3605
    }; //#3605
    $_.cget = function() {
        var _H = $k[--$j]; //#3606
        var _K = $get($_.cache, $f($k[--$j] + (_H * $_.pixx))); //#3606
        var _L = $k[--$j]; //#3606
        $k[$j++] = $an(_L, _K); //#3606
    }; //#3606
    $_.cput = function() {
        var _M = $k[--$j]; //#3608
        $k[$j++] = _M; //#3612
        if ((_M % 4) == 0) { //#3611
            var _N = $k[--$j]; //#3609
            var _O = $k[--$j]; //#3609
            var _P = $k[--$j]; //#3609
            var _Q = $_.pixx; //#3609
            var _R = $_.cache; //#3609
            $put(_R, $f(_P + (_O * _Q)), $or($get(_R, $f(_P + (_O * _Q))), _N)); //#3609
        } else { //#3611
            $j -= 3; //#3611
        } //#3611
    }; //#3611
    $_.abcd = function() {
        $k[$j++] = $s(4); //#3620
        $k[$j++] = 0; //#3620
        $k[$j++] = Infinity; //#3620
        var _U = $k[--$j]; //#3617
        var _V = $k[--$j]; //#3617
        var _W = $k[--$j]; //#3617
        var _X = $k[--$j]; //#3617
        var _a = $f($k[--$j] + (_X * $_.pixx)); //#3618
        $k[$j++] = _W; //#3619
        $k[$j++] = _V; //#3619
        $k[$j++] = _U; //#3619
        $k[$j++] = _a; //#3619
        $aload($geti($_.pixs, _a, 2)); //#3619
        var _d = $k[--$j]; //#3619
        var _e = $k[--$j]; //#3619
        var _i = $geti($_.pixs, $f($k[--$j] + $_.pixx), 2); //#3620
        $k[$j++] = _e; //#3620
        $k[$j++] = _d; //#3620
        $aload(_i); //#3620
        var _j = $a(); //#3620
        for (var _k = 0, _l = _j.length; _k < _l; _k++) { //#3621
            var _n = $k[--$j]; //#3621
            var _o = $k[--$j]; //#3621
            $put(_o, _n, $f($get(_j, _k) + 48)); //#3621
            $k[$j++] = _o; //#3621
            $k[$j++] = $f(_n + 1); //#3621
        } //#3621
        $j--; //#3621
    }; //#3621
    $_.right = function() {
        if ($_.dir != 1) { //#3624
            $k[$j++] = $_.x; //#3624
            $k[$j++] = $_.y; //#3624
            $k[$j++] = $_.dir; //#3624
            $_.cput(); //#3624
            $k[$j++] = $a([$_.x, $_.y]); //#3624
        } //#3624
        $_.x = $_.x + 1; //#3624
        $_.dir = 1; //#3624
    }; //#3624
    $_.down = function() {
        if ($_.dir != 2) { //#3625
            $k[$j++] = $_.x; //#3625
            $k[$j++] = $_.y; //#3625
            $k[$j++] = $_.dir; //#3625
            $_.cput(); //#3625
            $k[$j++] = $a([$_.x, $_.y]); //#3625
        } //#3625
        $_.y = $_.y + 1; //#3625
        $_.dir = 2; //#3625
    }; //#3625
    $_.left = function() {
        if ($_.dir != 4) { //#3626
            $k[$j++] = $_.x; //#3626
            $k[$j++] = $_.y; //#3626
            $k[$j++] = $_.dir; //#3626
            $_.cput(); //#3626
            $k[$j++] = $a([$_.x, $_.y]); //#3626
        } //#3626
        $_.x = $_.x - 1; //#3626
        $_.dir = 4; //#3626
    }; //#3626
    $_.up = function() {
        if ($_.dir != 8) { //#3627
            $k[$j++] = $_.x; //#3627
            $k[$j++] = $_.y; //#3627
            $k[$j++] = $_.dir; //#3627
            $_.cput(); //#3627
            $k[$j++] = $a([$_.x, $_.y]); //#3627
        } //#3627
        $_.y = $_.y - 1; //#3627
        $_.dir = 8; //#3627
    }; //#3627
    $_.trace = function() {
        $_.y = $k[--$j]; //#3631
        $_.x = $k[--$j]; //#3631
        $k[$j++] = 'dir'; //#3633
        $k[$j++] = $f($_.x + 1); //#3633
        $k[$j++] = $f($_.y + 1); //#3633
        $_.xyget(); //#3633
        var _1Q = ($k[--$j] == 1) ? 8 : 4; //#3633
        $_[$k[--$j]] = _1Q; //#3633
        $_.sx = $_.x; //#3634
        $_.sy = $_.y; //#3634
        $_.sdir = $_.dir; //#3634
        $k[$j++] = Infinity; //#3638
        for (;;) { //#3652
            $k[$j++] = $_.x; //#3639
            $k[$j++] = $_.y; //#3639
            $_.abcd(); //#3639
            for (var _1X = 0, _1Y = 1; _1X < _1Y; _1X++) { //#3650
                var _1Z = $k[--$j]; //#3641
                $k[$j++] = _1Z; //#3641
                if ($eq(_1Z, "0001") || ($eq(_1Z, "0011") || $eq(_1Z, "1011"))) { //#3641
                    $j--; //#3641
                    $_.right(); //#3641
                    break; //#3641
                } //#3641
                var _1a = $k[--$j]; //#3642
                $k[$j++] = _1a; //#3642
                if ($eq(_1a, "0010") || ($eq(_1a, "1010") || $eq(_1a, "1110"))) { //#3642
                    $j--; //#3642
                    $_.down(); //#3642
                    break; //#3642
                } //#3642
                var _1b = $k[--$j]; //#3643
                $k[$j++] = _1b; //#3643
                if ($eq(_1b, "1000") || ($eq(_1b, "1100") || $eq(_1b, "1101"))) { //#3643
                    $j--; //#3643
                    $_.left(); //#3643
                    break; //#3643
                } //#3643
                var _1c = $k[--$j]; //#3644
                $k[$j++] = _1c; //#3644
                if ($eq(_1c, "0100") || ($eq(_1c, "0101") || $eq(_1c, "0111"))) { //#3644
                    $j--; //#3644
                    $_.up(); //#3644
                    break; //#3644
                } //#3644
                var _1d = $k[--$j]; //#3645
                $k[$j++] = _1d; //#3649
                if ($eq(_1d, "1001")) { //#3648
                    if ($_.dir == 2) { //#3646
                        $j--; //#3646
                        $_.left(); //#3646
                        break; //#3646
                    } else { //#3646
                        $j--; //#3646
                        $_.right(); //#3646
                        break; //#3646
                    } //#3646
                } else { //#3648
                    if ($_.dir == 1) { //#3648
                        $j--; //#3648
                        $_.down(); //#3648
                        break; //#3648
                    } else { //#3648
                        $j--; //#3648
                        $_.up(); //#3648
                        break; //#3648
                    } //#3648
                } //#3648
            } //#3648
            if (($eq($_.x, $_.sx) && $eq($_.y, $_.sy)) && ($_.dir == $_.sdir)) { //#3651
                break; //#3651
            } //#3651
        } //#3651
        $astore($a($counttomark())); //#3653
        var _1o = $k[--$j]; //#3653
        var _1p = $k[--$j]; //#3653
        $k[$j++] = _1o; //#3653
        $k[$j++] = _1p; //#3653
        $j--; //#3653
    }; //#3653
    $_.drawlayer = function() {
        $_.pixsorig = $_.pixs; //#3679
        $_.pixs = $k[--$j]; //#3680
        $k[$j++] = Infinity; //#3690
        for (var _1t = 0, _1u = $_.pixx + 2; _1t < _1u; _1t++) { //#3684
            $k[$j++] = 0; //#3684
        } //#3684
        for (var _1y = 0, _1z = $_.pixx, _1x = $_.pixs.length - 1; _1z < 0 ? _1y >= _1x : _1y <= _1x; _1y += _1z) { //#3689
            $k[$j++] = 0; //#3687
            $aload($geti($_.pixs, _1y, $_.pixx)); //#3687
            $k[$j++] = 0; //#3688
        } //#3688
        for (var _24 = 0, _25 = $_.pixx + 2; _24 < _25; _24++) { //#3690
            $k[$j++] = 0; //#3690
        } //#3690
        $_.pixs = $a(); //#3690
        $_.pixx = $_.pixx + 2; //#3692
        $_.pixy = $_.pixy + 2; //#3693
        $k[$j++] = Infinity; //#3696
        for (var _2A = 0, _2B = $_.pixs.length; _2A < _2B; _2A++) { //#3696
            $k[$j++] = 0; //#3696
        } //#3696
        $_.cache = $a(); //#3696
        $k[$j++] = Infinity; //#3712
        for (var _2F = 0, _2E = $_.pixy - 2; _2F <= _2E; _2F += 1) { //#3716
            $_.j = _2F; //#3701
            for (var _2I = 0, _2H = $_.pixx - 2; _2I <= _2H; _2I += 1) { //#3715
                $_.i = _2I; //#3703
                $k[$j++] = 'k'; //#3704
                $k[$j++] = $_.i; //#3704
                $k[$j++] = $_.j; //#3704
                $_.abcd(); //#3704
                var _2L = $k[--$j]; //#3704
                $_[$k[--$j]] = _2L; //#3704
                if ($eq($_.k, "0001") || $eq($_.k, "1001")) { //#3709
                    $k[$j++] = 8; //#3706
                    $k[$j++] = $_.i; //#3706
                    $k[$j++] = $_.j; //#3706
                    $_.cget(); //#3706
                    if ($k[--$j] == 0) { //#3708
                        $k[$j++] = $_.i; //#3707
                        $k[$j++] = $_.j; //#3707
                        $_.trace(); //#3707
                    } //#3707
                } //#3707
                if ($eq($_.k, "1110")) { //#3714
                    $k[$j++] = 4; //#3711
                    $k[$j++] = $_.i; //#3711
                    $k[$j++] = $_.j; //#3711
                    $_.cget(); //#3711
                    if ($k[--$j] == 0) { //#3713
                        $k[$j++] = $_.i; //#3712
                        $k[$j++] = $_.j; //#3712
                        $_.trace(); //#3712
                    } //#3712
                } //#3712
            } //#3712
        } //#3712
        $_.paths = $a(); //#3712
        $_.pixx = $_.pixx - 2; //#3720
        $_.pixy = $_.pixy - 2; //#3721
        $$.newpath(); //#3724
        var _2d = $_.paths; //#3725
        for (var _2e = 0, _2f = _2d.length; _2e < _2f; _2e++) { //#3743
            $_.p = $get(_2d, _2e); //#3726
            $_.len = $_.p.length; //#3727
            $aload($get($_.p, $_.len - 1)); //#3728
            $aload($get($_.p, 0)); //#3729
            for (var _2p = 0, _2o = $_.len - 1; _2p <= _2o; _2p += 1) { //#3740
                $_.i = _2p; //#3731
                $aload($get($_.p, ($_.i + 1) % $_.len)); //#3732
                var _2u = $k[--$j]; //#3732
                var _2v = $k[--$j]; //#3732
                var _2w = $k[--$j]; //#3732
                var _2x = $k[--$j]; //#3732
                var _2y = $k[--$j]; //#3732
                var _2z = $k[--$j]; //#3732
                $k[$j++] = _2x; //#3734
                $k[$j++] = _2w; //#3734
                $k[$j++] = _2v; //#3734
                $k[$j++] = _2u; //#3734
                $k[$j++] = _2z; //#3734
                $k[$j++] = _2x; //#3734
                $k[$j++] = $_.inkspreadh; //#3734
                if ($lt(_2u, _2y)) { //#3734
                    var _31 = $k[--$j]; //#3734
                    var _32 = $k[--$j]; //#3734
                    $k[$j++] = $f(_32 + _31); //#3734
                } else { //#3734
                    var _33 = $k[--$j]; //#3734
                    var _34 = $k[--$j]; //#3734
                    $k[$j++] = $f(_34 - _33); //#3734
                } //#3734
                var _35 = $k[--$j]; //#3735
                var _36 = $k[--$j]; //#3735
                var _37 = $k[--$j]; //#3735
                var _38 = $k[--$j]; //#3735
                var _39 = $k[--$j]; //#3736
                $k[$j++] = _39; //#3737
                $k[$j++] = _35; //#3737
                $k[$j++] = _38; //#3737
                $k[$j++] = _37; //#3737
                $k[$j++] = _39; //#3737
                $k[$j++] = $_.inkspreadv; //#3737
                if ($gt(_38, _36)) { //#3737
                    var _3B = $k[--$j]; //#3737
                    var _3C = $k[--$j]; //#3737
                    $k[$j++] = $f(_3C + _3B); //#3737
                } else { //#3737
                    var _3D = $k[--$j]; //#3737
                    var _3E = $k[--$j]; //#3737
                    $k[$j++] = $f(_3E - _3D); //#3737
                } //#3737
                var _3F = $k[--$j]; //#3738
                var _3G = $k[--$j]; //#3738
                var _3H = $k[--$j]; //#3738
                var _3I = $k[--$j]; //#3738
                $k[$j++] = _3H; //#3739
                $k[$j++] = _3G; //#3739
                $k[$j++] = _3I; //#3739
                $k[$j++] = $f($_.pixy - _3F); //#3739
                if ($_.i == 0) { //#3739
                    var _3L = $k[--$j]; //#3739
                    $$.moveto($k[--$j], _3L); //#3739
                } else { //#3739
                    var _3N = $k[--$j]; //#3739
                    $$.lineto($k[--$j], _3N); //#3739
                } //#3739
            } //#3739
            $$.closepath(); //#3741
            $j -= 4; //#3742
        } //#3742
        $$.fill(); //#3744
        $_.pixs = $_.pixsorig; //#3746
    }; //#3746
    $_.drawlayerdots = function() {
        $_.pixsorig = $_.pixs; //#3752
        $_.pixs = $k[--$j]; //#3753
        $$.newpath(); //#3755
        for (var _3U = 0, _3T = $_.pixs.length - 1; _3U <= _3T; _3U += 1) { //#3763
            $_.x = _3U % $_.pixx; //#3757
            $_.y = ~~(_3U / $_.pixx); //#3758
            $k[$j++] = $_.x; //#3759
            $k[$j++] = $_.y; //#3759
            $_.xyget(); //#3759
            if ($k[--$j] == 1) { //#3762
                $$.moveto($f($_.x + 0.5), $f(($_.pixy - $_.y) - 0.5)); //#3760
                $$.arc($f($_.x + 0.5), $f(($_.pixy - $_.y) - 0.5), $f(0.5 - $_.inkspread), 0, 360, 1); //#3761
            } //#3761
        } //#3761
        $$.fill(); //#3764
        $_.pixs = $_.pixsorig; //#3766
    }; //#3766
    $$.save(); //#3770
    $_.inkspread = $_.inkspread / 2; //#3773
    $_.inkspreadh = $_.inkspreadh / 2; //#3774
    $_.inkspreadv = $_.inkspreadv / 2; //#3775
    var _3l = $$.currpos(); //#3776
    $$.translate(_3l.x, _3l.y); //#3776
    $$.scale(($_.width / $_.pixx) * 72, ($_.height / $_.pixy) * 72); //#3777
    $$.moveto(0, 0); //#3778
    $$.lineto($_.pixx, 0); //#3778
    $$.lineto($_.pixx, $_.pixy); //#3778
    $$.lineto(0, $_.pixy); //#3778
    $$.closepath(); //#3778
    if ($eq($_.colormap, "unset")) { //#3783
        var _3w = new Map([
            [1, $_.barcolor]
        ]); //#3782
        $_.colormap = _3w; //#3782
    } //#3782
    var _3x = $_.colormap; //#3785
    for (var _42 = _3x.size, _41 = _3x.keys(), _40 = 0; _40 < _42; _40++) { //#3791
        var _3y = _41.next().value; //#3791
        var _3z = _3x.get(_3y); //#3791
        $k[$j++] = _3y; //#3786
        $k[$j++] = _3z; //#3786
        if ($ne(_3z, "unset")) { //#3786
            $$.setcolor($k[--$j]); //#3786
        } else { //#3786
            $j--; //#3786
        } //#3786
        $_.key = $k[--$j]; //#3787
        $k[$j++] = Infinity; //#3789
        var _45 = $_.pixs; //#3789
        for (var _46 = 0, _47 = _45.length; _46 < _47; _46++) { //#3789
            var _4A = $eq($get(_45, _46), $_.key) ? 1 : 0; //#3789
            $k[$j++] = _4A; //#3789
        } //#3789
        var _4B = $a(); //#3789
        $k[$j++] = _4B; //#3790
        if ($_.dotty) { //#3790
            $_.drawlayerdots(); //#3790
        } else { //#3790
            $_.drawlayer(); //#3790
        } //#3790
    } //#3790
    if ($ne($_.textcolor, "unset")) { //#3794
        $$.setcolor($_.textcolor); //#3794
    } //#3794
    if ($_.includetext) { //#3855
        if (($eq($_.textxalign, "unset") && $eq($_.textyalign, "unset")) && $eq($_.alttext, "")) { //#3853
            $_.s = 0; //#3797
            $_.fn = ""; //#3797
            var _4J = $_.txt; //#3798
            for (var _4K = 0, _4L = _4J.length; _4K < _4L; _4K++) { //#3811
                $forall($get(_4J, _4K)); //#3799
                var _4N = $k[--$j]; //#3800
                var _4O = $k[--$j]; //#3800
                $k[$j++] = _4O; //#3809
                $k[$j++] = _4N; //#3809
                if ((_4N != $_.s) || $ne(_4O, $_.fn)) { //#3808
                    var _4R = $k[--$j]; //#3801
                    $k[$j++] = _4R; //#3804
                    if (_4R <= 0) { //#3804
                        $j -= 5; //#3802
                        $k[$j++] = 'bwipp.renmatrixFontTooSmall#3803'; //#3803
                        $k[$j++] = "The font size is too small"; //#3803
                        bwipp_raiseerror(); //#3803
                    } //#3803
                    var _4S = $k[--$j]; //#3805
                    var _4T = $k[--$j]; //#3805
                    $_.s = _4S; //#3805
                    $_.fn = _4T; //#3805
                    $$.selectfont(_4T, _4S); //#3806
                } else { //#3808
                    $j -= 2; //#3808
                } //#3808
                var _4U = $k[--$j]; //#3810
                $$.moveto($k[--$j], _4U); //#3810
                $$.show($k[--$j], 0, 0); //#3810
            } //#3810
        } else { //#3853
            $$.selectfont($_.textfont, $_.textsize); //#3813
            if ($eq($_.alttext, "")) { //#3819
                $k[$j++] = Infinity; //#3815
                var _4a = $_.txt; //#3815
                for (var _4b = 0, _4c = _4a.length; _4b < _4c; _4b++) { //#3815
                    $forall($get($get(_4a, _4b), 0)); //#3815
                } //#3815
                $_.txt = $a(); //#3815
                $_.tstr = $s($_.txt.length); //#3816
                for (var _4k = 0, _4j = $_.txt.length - 1; _4k <= _4j; _4k += 1) { //#3817
                    $put($_.tstr, _4k, $get($_.txt, _4k)); //#3817
                } //#3817
            } else { //#3819
                $_.tstr = $_.alttext; //#3819
            } //#3819
            if ($_.tstr.length == 0) { //#3829
                $k[$j++] = 0; //#3824
            } else { //#3829
                $$.save(); //#3826
                $$.newpath(); //#3827
                $$.moveto(0, 0); //#3827
                $$.charpath("0", false); //#3827
                var _4q = $$.pathbbox(); //#3827
                $$.restore(); //#3829
                $k[$j++] = _4q.ury; //#3829
            } //#3829
            $_.textascent = $k[--$j]; //#3838
            var _4t = $$.stringwidth($_.tstr); //#3839
            $_.textwidth = $f(_4t.w + (($_.tstr.length - 1) * $_.textgaps)); //#3839
            $_.textxpos = $f($_.textxoffset + ($f($_.pixx - $_.textwidth) / 2)); //#3841
            if ($eq($_.textxalign, "left")) { //#3842
                $_.textxpos = $_.textxoffset; //#3842
            } //#3842
            if ($eq($_.textxalign, "right")) { //#3843
                $_.textxpos = $f(($_.pixx - $_.textxoffset) - $_.textwidth); //#3843
            } //#3843
            if ($eq($_.textxalign, "offleft")) { //#3844
                $_.textxpos = -$f($_.textwidth + $_.textxoffset); //#3844
            } //#3844
            if ($eq($_.textxalign, "offright")) { //#3845
                $_.textxpos = $_.pixx + $_.textxoffset; //#3845
            } //#3845
            if ($eq($_.textxalign, "justify") && ($_.textwidth < $_.pixx)) { //#3849
                $_.textxpos = 0; //#3847
                $_.textgaps = $f($_.pixx - $_.textwidth) / ($_.tstr.length - 1); //#3848
            } //#3848
            $_.textypos = -($f($f($_.textyoffset + $_.textascent) + 1)); //#3850
            if ($eq($_.textyalign, "above")) { //#3851
                $_.textypos = ($_.textyoffset + $_.pixy) + 1; //#3851
            } //#3851
            if ($eq($_.textyalign, "center")) { //#3852
                $_.textypos = $f($_.textyoffset + ($f($_.pixy - $_.textascent) / 2)); //#3852
            } //#3852
            $$.moveto($_.textxpos, $_.textypos); //#3853
            $$.show($_.tstr, $_.textgaps, 0); //#3853
        } //#3853
    } //#3853
    $$.restore(); //#3857
    $_ = Object.getPrototypeOf($_); //#3859
}

// bwip-js/barcode-ftr.js
//
// This code is injected below the cross-compiled barcode.js.

// `encoder` is one of the bwipp_ functions
function bwipp_encode(bwipjs, encoder, text, opts, dontdraw) {
    if (typeof text !== 'string') {
        throw new Error('bwipp.typeError: barcode text not a string (' +
            text + ')');
    }
    opts = opts || {};
    if (typeof opts === 'string') {
        var tmp = opts.split(' ');
        opts = {};
        for (var i = 0; i < tmp.length; i++) {
            if (!tmp[i]) {
                continue;
            }
            var eq = tmp[i].indexOf('=');
            if (eq == -1) {
                opts[tmp[i]] = true;
            } else {
                opts[tmp[i].substr(0, eq)] = tmp[i].substr(eq + 1);
            }
        }
    } else if (typeof opts !== 'object' || opts.constructor !== Object) {
        throw new Error('bwipp.typeError: options not an object');
    }

    // Convert utf-16 to utf-8 unless caller has pre-encoded the text.
    if (opts.binarytext) {
        // No 16-bit chars allowed.
        if (/[\u0100-\uffff]/.test(text)) {
            throw new Error('bwip-js: 16-bit chars not allowed with binarytext');
        }
    } else if (/[\u0080-\uffff]/.test(text)) {
        text = unescape(encodeURIComponent(text));
    }

    // Convert opts to a Map
    var map = new Map;
    for (var id in opts) {
        if (opts.hasOwnProperty(id)) {
            map.set(id, opts[id]);
        }
    }

    // Set up the initial postscript state and invoke the encoder
    $$ = bwipjs;
    $k = [text, map];
    $j = 2;
    $_ = {
        bwipjs_dontdraw: opts.dontdraw || dontdraw || false
    };
    encoder();

    // Return what is left on the stack.  This branch should only be taken
    // when running with the dontdraw option.
    if ($j) {
        return $k.splice(0, $j);
    }

    return true;
}

function bwipp_qrcode() {
    $_ = Object.create($_); //#19503
    $_.dontdraw = false; //#19506
    $_.format = "unset"; //#19507
    $_.version = "unset"; //#19508
    $_.eclevel = "unset"; //#19509
    $_.parse = false; //#19510
    $_.parsefnc = false; //#19511
    $_.mask = -1; //#19512
    $k[$j++] = $_; //#19514
    bwipp_processoptions(); //#19514
    $_.options = $k[--$j]; //#19514
    $_.barcode = $k[--$j]; //#19515
    bwipp_loadctx(bwipp_qrcode) //#19517
    if ($eq($_.barcode, "")) { //#19521
        $k[$j++] = 'bwipp.qrcodeEmptyData#19520'; //#19520
        $k[$j++] = "The data must not be empty"; //#19520
        bwipp_raiseerror(); //#19520
    } //#19520
    if ($ne($_.version, "unset")) { //#19532
        if ($eq($_.format, "unset")) { //#19530
            $k[$j++] = "full"; //#19527
            if ($eq($geti($_.version, 0, 1), "M")) { //#19527
                $j--; //#19527
                $k[$j++] = "micro"; //#19527
            } //#19527
            if ($eq($geti($_.version, 0, 1), "R")) { //#19528
                $j--; //#19528
                $k[$j++] = "rmqr"; //#19528
            } //#19528
            $_.format = $k[--$j]; //#19529
        } //#19529
    } else { //#19532
        if ($eq($_.format, "unset")) { //#19532
            $_.format = "full"; //#19532
        } //#19532
    } //#19532
    if ($ne($_.format, "full") && ($ne($_.format, "micro") && $ne($_.format, "rmqr"))) { //#19537
        $k[$j++] = 'bwipp.qrcodeInvalidFormat#19536'; //#19536
        $k[$j++] = "The format must be either full, micro or rmqr"; //#19536
        bwipp_raiseerror(); //#19536
    } //#19536
    if ($eq($_.format, "rmqr") && $eq($_.version, "unset")) { //#19541
        $k[$j++] = 'bwipp.qrcodeRMQRwithoutVersion#19540'; //#19540
        $k[$j++] = "A version must be provided for RMQR"; //#19540
        bwipp_raiseerror(); //#19540
    } //#19540
    if ($eq($_.eclevel, "unset")) { //#19544
        $k[$j++] = 'eclevel'; //#19544
        if ($ne($_.format, "micro")) { //#19544
            $k[$j++] = "M"; //#19544
        } else { //#19544
            $k[$j++] = "L"; //#19544
        } //#19544
        var _I = $k[--$j]; //#19544
        $_[$k[--$j]] = _I; //#19544
    } //#19544
    if ($ne($_.eclevel, "L") && ($ne($_.eclevel, "M") && ($ne($_.eclevel, "Q") && $ne($_.eclevel, "H")))) { //#19548
        $k[$j++] = 'bwipp.qrcodeInvalidEClevel#19547'; //#19547
        $k[$j++] = "Error correction level must be either L, M, Q, or H"; //#19547
        bwipp_raiseerror(); //#19547
    } //#19547
    if (($_.mask != -1) && $eq($_.format, "rmqr")) { //#19552
        $k[$j++] = 'bwipp.qrcodeRMQRmask#19551'; //#19551
        $k[$j++] = "A mask cannot be supplied for RMQR"; //#19551
        bwipp_raiseerror(); //#19551
    } //#19551
    if ($_.mask != -1) { //#19558
        var _U = $eq($_.format, "full") ? 8 : 4; //#19555
        if (($_.mask < 1) || ($_.mask > _U)) { //#19557
            $k[$j++] = 'bwipp.qrcodeBadMask#19556'; //#19556
            $k[$j++] = "An invalid mask was supplied"; //#19556
            bwipp_raiseerror(); //#19556
        } //#19556
    } //#19556
    $_.fn1 = -1; //#19561
    var _Y = new Map([
        ["parse", $_.parse],
        ["parsefnc", $_.parsefnc],
        ["eci", true],
        ["FNC1", $_.fn1]
    ]); //#19566
    $_.fncvals = _Y; //#19567
    $k[$j++] = 'msg'; //#19568
    $k[$j++] = $_.barcode; //#19568
    $k[$j++] = $_.fncvals; //#19568
    bwipp_parseinput(); //#19568
    var _b = $k[--$j]; //#19568
    $_[$k[--$j]] = _b; //#19568
    $_.msglen = $_.msg.length; //#19569
    $_.fnc1first = false; //#19572
    if ($_.msglen > 0) { //#19579
        if ($get($_.msg, 0) == $_.fn1) { //#19578
            $_.fnc1first = true; //#19575
            $k[$j++] = Infinity; //#19576
            var _k = $geti($_.msg, 1, $_.msglen - 1); //#19576
            for (var _l = 0, _m = _k.length; _l < _m; _l++) { //#19576
                var _n = $get(_k, _l); //#19576
                $k[$j++] = _n; //#19576
                if (_n == 37) { //#19576
                    var _o = $k[--$j]; //#19576
                    $k[$j++] = _o; //#19576
                    $k[$j++] = _o; //#19576
                } //#19576
            } //#19576
            $_.msg = $a(); //#19576
            $_.msglen = $_.msg.length; //#19577
        } //#19577
    } //#19577
    if (!bwipp_qrcode.__19700__) { //#19700
        $_ = Object.create($_); //#19700
        var _r = $a(['v1to9', 'v10to26', 'v27to40', 'vM1', 'vM2', 'vM3', 'vM4', 'vR7x43', 'vR7x59', 'vR7x77', 'vR7x99', 'vR7x139', 'vR9x43', 'vR9x59', 'vR9x77', 'vR9x99', 'vR9x139', 'vR11x27', 'vR11x43', 'vR11x59', 'vR11x77', 'vR11x99', 'vR11x139', 'vR13x27', 'vR13x43', 'vR13x59', 'vR13x77', 'vR13x99', 'vR13x139', 'vR15x43', 'vR15x59', 'vR15x77', 'vR15x99', 'vR15x139', 'vR17x43', 'vR17x59', 'vR17x77', 'vR17x99', 'vR17x139']); //#19592
        $k[$j++] = 0; //#19593
        for (var _s = 0, _t = _r.length; _s < _t; _s++) { //#19593
            var _v = $k[--$j]; //#19593
            $_[$get(_r, _s)] = _v; //#19593
            $k[$j++] = $f(_v + 1); //#19593
        } //#19593
        $j--; //#19593
        $_.N = 0; //#19599
        $_.A = 1; //#19599
        $_.B = 2; //#19599
        $_.K = 3; //#19599
        $_.E = 4; //#19599
        $k[$j++] = Infinity; //#19604
        $k[$j++] = Infinity; //#19603
        for (var _w = 48; _w <= 57; _w += 1) { //#19603
            $k[$j++] = _w; //#19603
        } //#19603
        var _x = $a(); //#19603
        for (var _y = 0, _z = _x.length; _y < _z; _y++) { //#19604
            $k[$j++] = $get(_x, _y); //#19604
            $k[$j++] = -1; //#19604
        } //#19604
        $_.Nexcl = $d(); //#19605
        $k[$j++] = Infinity; //#19612
        $k[$j++] = Infinity; //#19611
        $k[$j++] = 32; //#19610
        $k[$j++] = 36; //#19610
        $k[$j++] = 37; //#19610
        $k[$j++] = 42; //#19610
        $k[$j++] = 43; //#19610
        $k[$j++] = 45; //#19610
        $k[$j++] = 46; //#19610
        $k[$j++] = 47; //#19610
        $k[$j++] = 58; //#19610
        for (var _12 = 65; _12 <= 90; _12 += 1) { //#19610
            $k[$j++] = _12; //#19610
        } //#19610
        $k[$j++] = $_.fn1; //#19611
        var _14 = $a(); //#19611
        for (var _15 = 0, _16 = _14.length; _15 < _16; _15++) { //#19612
            $k[$j++] = $get(_14, _15); //#19612
            $k[$j++] = -1; //#19612
        } //#19612
        $_.Aexcl = $d(); //#19613
        $k[$j++] = Infinity; //#19621
        $k[$j++] = Infinity; //#19620
        for (var _19 = 129; _19 <= 159; _19 += 1) { //#19619
            $k[$j++] = _19; //#19619
        } //#19619
        for (var _1A = 224; _1A <= 235; _1A += 1) { //#19620
            $k[$j++] = _1A; //#19620
        } //#19620
        var _1B = $a(); //#19620
        for (var _1C = 0, _1D = _1B.length; _1C < _1D; _1C++) { //#19621
            $k[$j++] = $get(_1B, _1C); //#19621
            $k[$j++] = -1; //#19621
        } //#19621
        $_.Kexcl = $d(); //#19622
        $k[$j++] = Infinity; //#19634
        $k[$j++] = $a(["0001", "0010", "0100", "1000", "0111"]); //#19635
        $k[$j++] = $a(["0001", "0010", "0100", "1000", "0111"]); //#19635
        $k[$j++] = $a(["0001", "0010", "0100", "1000", "0111"]); //#19635
        $k[$j++] = $a(["", -1, -1, -1, -1]); //#19635
        $k[$j++] = $a(["0", "1", -1, -1, -1]); //#19635
        $k[$j++] = $a(["00", "01", "10", "11", -1]); //#19635
        $k[$j++] = $a(["000", "001", "010", "011", -1]); //#19635
        for (var _1N = 0, _1O = 32; _1N < _1O; _1N++) { //#19635
            $k[$j++] = $a(["001", "010", "011", "100", "111"]); //#19634
        } //#19634
        $_.mids = $a(); //#19634
        $_.cclens = $a([$a([10, 9, 8, 8]), $a([12, 11, 16, 10]), $a([14, 13, 16, 12]), $a([3, -1, -1, -1]), $a([4, 3, -1, -1]), $a([5, 4, 4, 3]), $a([6, 5, 5, 4]), $a([4, 3, 3, 2]), $a([5, 5, 4, 3]), $a([6, 5, 5, 4]), $a([7, 6, 5, 5]), $a([7, 6, 6, 5]), $a([5, 5, 4, 3]), $a([6, 5, 5, 4]), $a([7, 6, 5, 5]), $a([7, 6, 6, 5]), $a([8, 7, 6, 6]), $a([4, 4, 3, 2]), $a([6, 5, 5, 4]), $a([7, 6, 5, 5]), $a([7, 6, 6, 5]), $a([8, 7, 6, 6]), $a([8, 7, 7, 6]), $a([5, 5, 4, 3]), $a([6, 6, 5, 5]), $a([7, 6, 6, 5]), $a([7, 7, 6, 6]), $a([8, 7, 7, 6]), $a([8, 8, 7, 7]), $a([7, 6, 6, 5]), $a([7, 7, 6, 5]), $a([8, 7, 7, 6]), $a([8, 7, 7, 6]), $a([9, 8, 7, 7]), $a([7, 6, 6, 5]), $a([8, 7, 6, 6]), $a([8, 7, 7, 6]), $a([8, 8, 7, 6]), $a([9, 8, 8, 7])]); //#19678
        $k[$j++] = Infinity; //#19689
        for (var _25 = 0, _26 = 3; _25 < _26; _25++) { //#19683
            $k[$j++] = 4; //#19682
        } //#19682
        $k[$j++] = 3; //#19690
        $k[$j++] = 5; //#19690
        $k[$j++] = 7; //#19690
        $k[$j++] = 9; //#19690
        for (var _27 = 0, _28 = 32; _27 < _28; _27++) { //#19690
            $k[$j++] = 3; //#19689
        } //#19689
        $_.termlens = $a(); //#19689
        $_.padstrs = $a(["11101100", "00010001"]); //#19693
        $_.charmap = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:"; //#19696
        $_.charvals = new Map; //#19697
        for (var _2B = 0; _2B <= 44; _2B += 1) { //#19698
            $put($_.charvals, $get($_.charmap, _2B), _2B); //#19698
        } //#19698
        for (var id in $_) $_.hasOwnProperty(id) && (bwipp_qrcode.$ctx[id] = $_[id]); //#19698
        bwipp_qrcode.__19700__ = 1; //#19698
        $_ = Object.getPrototypeOf($_); //#19698
    } //#19698
    $_.tobin = function() {
        var _2H = $s($k[--$j]); //#19704
        $k[$j++] = _2H; //#19704
        for (var _2J = 0, _2I = _2H.length - 1; _2J <= _2I; _2J += 1) { //#19704
            var _2K = $k[--$j]; //#19704
            $put(_2K, _2J, 48); //#19704
            $k[$j++] = _2K; //#19704
        } //#19704
        var _2L = $k[--$j]; //#19705
        var _2O = $cvrs($s(_2L.length), $k[--$j], 2); //#19705
        $puti(_2L, _2L.length - _2O.length, _2O); //#19705
        $k[$j++] = _2L; //#19705
    }; //#19705
    $_.encA = function() {
        $_.in = $k[--$j]; //#19709
        if ($_.fnc1first) { //#19712
            $k[$j++] = Infinity; //#19711
            $forall($_.in, function() { //#19711
                var _2S = $k[--$j]; //#19711
                $k[$j++] = _2S; //#19711
                if (_2S == $_.fn1) { //#19711
                    $j--; //#19711
                    $k[$j++] = 37; //#19711
                } //#19711
            }); //#19711
            $_.in = $a(); //#19711
        } //#19711
        $_.out = $s((~~(($_.in.length * 11) / 2)) + 1); //#19713
        $_.k = 0; //#19714
        $_.m = 0; //#19714
        for (;;) { //#19725
            if ($_.k == $_.in.length) { //#19715
                break; //#19715
            } //#19715
            if ($_.k < ($_.in.length - 1)) { //#19721
                $k[$j++] = $f(($get($_.charvals, $get($_.in, $_.k)) * 45) + $get($_.charvals, $get($_.in, $_.k + 1))); //#19717
                $k[$j++] = 11; //#19717
                $_.tobin(); //#19717
                $_.k = $_.k + 2; //#19718
            } else { //#19721
                $k[$j++] = $get($_.charvals, $get($_.in, $_.k)); //#19720
                $k[$j++] = 6; //#19720
                $_.tobin(); //#19720
                $_.k = $_.k + 1; //#19721
            } //#19721
            var _2s = $k[--$j]; //#19723
            $puti($_.out, $_.m, _2s); //#19723
            $_.m = _2s.length + $_.m; //#19724
        } //#19724
        $k[$j++] = $geti($_.out, 0, $_.m); //#19726
    }; //#19726
    $_.encN = function() {
        $_.in = $k[--$j]; //#19730
        $_.out = $s((~~(($_.in.length * 10) / 3)) + 1); //#19731
        $_.k = 0; //#19732
        $_.m = 0; //#19732
        for (;;) { //#19748
            if ($_.k == $_.in.length) { //#19733
                break; //#19733
            } //#19733
            if ($_.k < ($_.in.length - 2)) { //#19743
                var _38 = $geti($_.in, $_.k, 3); //#19735
                $k[$j++] = 0; //#19735
                for (var _39 = 0, _3A = _38.length; _39 < _3A; _39++) { //#19735
                    var _3C = $k[--$j]; //#19735
                    $k[$j++] = $f($get(_38, _39) + ($f((_3C * 10) - 48))); //#19735
                } //#19735
                $k[$j++] = 10; //#19735
                $_.tobin(); //#19735
                $_.k = $_.k + 3; //#19736
            } else { //#19743
                if ($_.k == ($_.in.length - 2)) { //#19743
                    var _3I = $geti($_.in, $_.k, 2); //#19739
                    $k[$j++] = 0; //#19739
                    for (var _3J = 0, _3K = _3I.length; _3J < _3K; _3J++) { //#19739
                        var _3M = $k[--$j]; //#19739
                        $k[$j++] = $f($get(_3I, _3J) + ($f((_3M * 10) - 48))); //#19739
                    } //#19739
                    $k[$j++] = 7; //#19739
                    $_.tobin(); //#19739
                    $_.k = $_.k + 2; //#19740
                } else { //#19743
                    var _3Q = $geti($_.in, $_.k, 1); //#19742
                    $k[$j++] = 0; //#19742
                    for (var _3R = 0, _3S = _3Q.length; _3R < _3S; _3R++) { //#19742
                        var _3U = $k[--$j]; //#19742
                        $k[$j++] = $f($get(_3Q, _3R) + ($f((_3U * 10) - 48))); //#19742
                    } //#19742
                    $k[$j++] = 4; //#19742
                    $_.tobin(); //#19742
                    $_.k = $_.k + 1; //#19743
                } //#19743
            } //#19743
            var _3W = $k[--$j]; //#19746
            $puti($_.out, $_.m, _3W); //#19746
            $_.m = _3W.length + $_.m; //#19747
        } //#19747
        $k[$j++] = $geti($_.out, 0, $_.m); //#19749
    }; //#19749
    $_.encB = function() {
        $_.in = $k[--$j]; //#19753
        if ($_.fnc1first) { //#19756
            $k[$j++] = Infinity; //#19755
            $forall($_.in, function() { //#19755
                var _3g = $k[--$j]; //#19755
                $k[$j++] = _3g; //#19755
                if (_3g == $_.fn1) { //#19755
                    $j--; //#19755
                    $k[$j++] = 29; //#19755
                } //#19755
            }); //#19755
            $_.in = $a(); //#19755
        } //#19755
        $_.out = $s($_.in.length * 8); //#19757
        for (var _3n = 0, _3m = $_.in.length - 1; _3n <= _3m; _3n += 1) { //#19762
            $_.k = _3n; //#19759
            $k[$j++] = $cvi($get($_.in, $_.k)); //#19760
            $k[$j++] = 8; //#19760
            $_.tobin(); //#19760
            $puti($_.out, $_.k * 8, $k[--$j]); //#19761
        } //#19761
        $k[$j++] = $_.out; //#19763
    }; //#19763
    $_.encK = function() {
        $_.in = $k[--$j]; //#19767
        $_.out = $s((~~($_.in.length / 2)) * 13); //#19768
        $_.k = 0; //#19769
        $_.m = 0; //#19769
        for (;;) { //#19777
            if ($_.k == $_.in.length) { //#19770
                break; //#19770
            } //#19770
            var _46 = $f(($get($_.in, $_.k) * 256) + $get($_.in, $_.k + 1)); //#19772
            $k[$j++] = _46; //#19772
            if (_46 < 57408) { //#19772
                $k[$j++] = 33088; //#19772
            } else { //#19772
                $k[$j++] = 49472; //#19772
            } //#19772
            var _47 = $k[--$j]; //#19772
            var _49 = $f($k[--$j] - _47); //#19773
            $k[$j++] = $f(((_49 >>> 8) * 192) + (_49 & 255)); //#19774
            $k[$j++] = 13; //#19774
            $_.tobin(); //#19774
            var _4A = $k[--$j]; //#19774
            $puti($_.out, $_.m, _4A); //#19774
            $_.m = _4A.length + $_.m; //#19775
            $_.k = $_.k + 2; //#19776
        } //#19776
        $k[$j++] = $_.out; //#19778
    }; //#19778
    $_.encE = function() {
        var _4I = $f((-$get($k[--$j], 0)) - 1000000); //#19783
        $k[$j++] = _4I; //#19789
        if (_4I <= 127) { //#19788
            $k[$j++] = 8; //#19784
            $_.tobin(); //#19784
        } else { //#19788
            var _4J = $k[--$j]; //#19785
            $k[$j++] = _4J; //#19789
            if (_4J <= 16383) { //#19788
                var _4K = $k[--$j]; //#19786
                $k[$j++] = $f(_4K + 32768); //#19786
                $k[$j++] = 16; //#19786
                $_.tobin(); //#19786
            } else { //#19788
                var _4L = $k[--$j]; //#19788
                $k[$j++] = $f(_4L + 12582912); //#19788
                $k[$j++] = 24; //#19788
                $_.tobin(); //#19788
            } //#19788
        } //#19788
    }; //#19788
    $_.encfuncs = $a(['encN', 'encA', 'encB', 'encK', 'encE']); //#19792
    $_.addtobits = function() {
        var _4N = $k[--$j]; //#19795
        $puti($_.bits, $_.j, _4N); //#19795
        $_.j = _4N.length + $_.j; //#19796
    }; //#19796
    $k[$j++] = Infinity; //#19799
    for (var _4S = 0, _4T = $_.msglen; _4S < _4T; _4S++) { //#19799
        $k[$j++] = 0; //#19799
    } //#19799
    $k[$j++] = 0; //#19799
    $_.numNs = $a(); //#19799
    $k[$j++] = Infinity; //#19800
    for (var _4W = 0, _4X = $_.msglen; _4W < _4X; _4W++) { //#19800
        $k[$j++] = 0; //#19800
    } //#19800
    $k[$j++] = 0; //#19800
    $_.numAs = $a(); //#19800
    $k[$j++] = Infinity; //#19801
    for (var _4a = 0, _4b = $_.msglen; _4a < _4b; _4a++) { //#19801
        $k[$j++] = 0; //#19801
    } //#19801
    $k[$j++] = 0; //#19801
    $_.numAorNs = $a(); //#19801
    $k[$j++] = Infinity; //#19802
    for (var _4e = 0, _4f = $_.msglen; _4e < _4f; _4e++) { //#19802
        $k[$j++] = 0; //#19802
    } //#19802
    $k[$j++] = 0; //#19802
    $_.numBs = $a(); //#19802
    $k[$j++] = Infinity; //#19803
    for (var _4i = 0, _4j = $_.msglen; _4i < _4j; _4i++) { //#19803
        $k[$j++] = 0; //#19803
    } //#19803
    $k[$j++] = 0; //#19803
    $_.numKs = $a(); //#19803
    $k[$j++] = Infinity; //#19804
    for (var _4m = 0, _4n = $_.msglen; _4m < _4n; _4m++) { //#19804
        $k[$j++] = 0; //#19804
    } //#19804
    $k[$j++] = 9999; //#19804
    $_.nextNs = $a(); //#19804
    $k[$j++] = Infinity; //#19805
    for (var _4q = 0, _4r = $_.msglen; _4q < _4r; _4q++) { //#19805
        $k[$j++] = 0; //#19805
    } //#19805
    $k[$j++] = 9999; //#19805
    $_.nextBs = $a(); //#19805
    $k[$j++] = Infinity; //#19806
    for (var _4u = 0, _4v = $_.msglen; _4u < _4v; _4u++) { //#19806
        $k[$j++] = 0; //#19806
    } //#19806
    $k[$j++] = 9999; //#19806
    $_.nextAs = $a(); //#19806
    $k[$j++] = Infinity; //#19807
    for (var _4y = 0, _4z = $_.msglen; _4y < _4z; _4y++) { //#19807
        $k[$j++] = 0; //#19807
    } //#19807
    $k[$j++] = 9999; //#19807
    $_.nextKs = $a(); //#19807
    $_.isECI = $a($_.msglen); //#19808
    for (var _54 = $_.msglen - 1; _54 >= 0; _54 -= 1) { //#19838
        $_.i = _54; //#19810
        $_.barchar = $get($_.msg, $_.i); //#19811
        var _5A = $get($_.Kexcl, $_.barchar) !== undefined; //#19812
        if (_5A) { //#19821
            $k[$j++] = 'sjis'; //#19813
            if (($_.i + 1) < $_.msglen) { //#19813
                $k[$j++] = $f(($_.barchar * 256) + $get($_.msg, $_.i + 1)); //#19813
            } else { //#19813
                $k[$j++] = 0; //#19813
            } //#19813
            var _5H = $k[--$j]; //#19813
            $_[$k[--$j]] = _5H; //#19813
            if ((($_.sjis >= 33088) && ($_.sjis <= 40956)) || (($_.sjis >= 57408) && ($_.sjis <= 60351))) { //#19818
                $put($_.nextKs, $_.i, 0); //#19815
                $put($_.numKs, $_.i, $f($get($_.numKs, $_.i + 2) + 1)); //#19816
            } else { //#19818
                $put($_.nextKs, $_.i, $f($get($_.nextKs, $_.i + 1) + 1)); //#19818
            } //#19818
        } else { //#19821
            $put($_.nextKs, $_.i, $f($get($_.nextKs, $_.i + 1) + 1)); //#19821
        } //#19821
        var _5g = $get($_.Nexcl, $_.barchar) !== undefined; //#19823
        if (_5g) { //#19828
            $put($_.nextNs, $_.i, 0); //#19824
            $put($_.numNs, $_.i, $f($get($_.numNs, $_.i + 1) + 1)); //#19825
            $put($_.numAorNs, $_.i, $f($get($_.numAorNs, $_.i + 1) + 1)); //#19826
        } else { //#19828
            $put($_.nextNs, $_.i, $f($get($_.nextNs, $_.i + 1) + 1)); //#19828
        } //#19828
        var _60 = $get($_.Aexcl, $_.barchar) !== undefined; //#19830
        if (_60) { //#19835
            $put($_.nextAs, $_.i, 0); //#19831
            $put($_.numAs, $_.i, $f($get($_.numAs, $_.i + 1) + 1)); //#19832
            $put($_.numAorNs, $_.i, $f($get($_.numAorNs, $_.i + 1) + 1)); //#19833
        } else { //#19835
            $put($_.nextAs, $_.i, $f($get($_.nextAs, $_.i + 1) + 1)); //#19835
        } //#19835
        $put($_.isECI, $_.i, $_.barchar <= -1000000); //#19837
    } //#19837
    for (var _6N = 0, _6M = $_.msglen - 1; _6N <= _6M; _6N += 1) { //#19845
        $_.i = _6N; //#19840
        if ($get($_.numKs, $_.i) > 0) { //#19844
            $put($_.numKs, $_.i + 1, 0); //#19842
            $put($_.nextKs, $_.i + 1, $f($get($_.nextKs, $_.i + 1) + 1)); //#19843
        } //#19843
    } //#19843
    for (var _6Z = $_.msglen - 1; _6Z >= 0; _6Z -= 1) { //#19854
        $_.i = _6Z; //#19847
        if ((($f($get($_.numNs, $_.i) + $f($get($_.numAs, $_.i) + $get($_.numKs, $_.i)))) == 0) && $nt($get($_.isECI, $_.i))) { //#19852
            $put($_.nextBs, $_.i, 0); //#19849
            $put($_.numBs, $_.i, $f($get($_.numBs, $_.i + 1) + 1)); //#19850
        } else { //#19852
            $put($_.nextBs, $_.i, $f($get($_.nextBs, $_.i + 1) + 1)); //#19852
        } //#19852
    } //#19852
    $_.KbeforeB = function() {
        var _71 = $get($k[--$j], $_.ver); //#19856
        $k[$j++] = $ge($_.numK, _71) && ($get($_.nextBs, $f(($_.numK * 2) + $_.i)) == 0); //#19856
    }; //#19856
    $_.KbeforeA = function() {
        var _79 = $get($k[--$j], $_.ver); //#19857
        $k[$j++] = $ge($_.numK, _79) && ($get($_.nextAs, $f(($_.numK * 2) + $_.i)) == 0); //#19857
    }; //#19857
    $_.KbeforeN = function() {
        var _7H = $get($k[--$j], $_.ver); //#19858
        $k[$j++] = $ge($_.numK, _7H) && ($get($_.nextNs, $f(($_.numK * 2) + $_.i)) == 0); //#19858
    }; //#19858
    $_.KbeforeE = function() {
        var _7P = $get($k[--$j], $_.ver); //#19859
        $k[$j++] = $ge($_.numK, _7P) && (($f(($_.numK * 2) + $_.i)) == $_.msglen); //#19859
    }; //#19859
    $_.AbeforeK = function() {
        var _7W = $get($k[--$j], $_.ver); //#19860
        $k[$j++] = $ge($_.numA, _7W) && ($get($_.nextKs, $f($_.numA + $_.i)) == 0); //#19860
    }; //#19860
    $_.AbeforeB = function() {
        var _7e = $get($k[--$j], $_.ver); //#19861
        $k[$j++] = $ge($_.numA, _7e) && ($get($_.nextBs, $f($_.numA + $_.i)) == 0); //#19861
    }; //#19861
    $_.AbeforeN = function() {
        var _7m = $get($k[--$j], $_.ver); //#19862
        $k[$j++] = $ge($_.numA, _7m) && ($get($_.nextNs, $f($_.numA + $_.i)) == 0); //#19862
    }; //#19862
    $_.AbeforeE = function() {
        var _7u = $get($k[--$j], $_.ver); //#19863
        $k[$j++] = $ge($_.numA, _7u) && ($f($_.numA + $_.i) == $_.msglen); //#19863
    }; //#19863
    $_.NbeforeK = function() {
        var _81 = $get($k[--$j], $_.ver); //#19864
        $k[$j++] = $ge($_.numN, _81) && ($get($_.nextKs, $f($_.numN + $_.i)) == 0); //#19864
    }; //#19864
    $_.NbeforeB = function() {
        var _89 = $get($k[--$j], $_.ver); //#19865
        $k[$j++] = $ge($_.numN, _89) && ($get($_.nextBs, $f($_.numN + $_.i)) == 0); //#19865
    }; //#19865
    $_.NbeforeA = function() {
        var _8H = $get($k[--$j], $_.ver); //#19866
        $k[$j++] = $ge($_.numN, _8H) && ($get($_.nextAs, $f($_.numN + $_.i)) == 0); //#19866
    }; //#19866
    $_.NbeforeE = function() {
        var _8P = $get($k[--$j], $_.ver); //#19867
        $k[$j++] = $ge($_.numN, _8P) && ($f($_.numN + $_.i) == $_.msglen); //#19867
    }; //#19867
    $_.AorNbeforeB = function() {
        var _8W = $get($k[--$j], $_.ver); //#19868
        $k[$j++] = $ge($_.numAorN, _8W) && ($get($_.nextBs, $f($_.numAorN + $_.i)) == 0); //#19868
    }; //#19868
    $_.AorNbeforeE = function() {
        var _8e = $get($k[--$j], $_.ver); //#19869
        $k[$j++] = $ge($_.numAorN, _8e) && ($f($_.numAorN + $_.i) == $_.msglen); //#19869
    }; //#19869
    $_.nextNslt = function() {
        if ($get($_.nextNs, $_.i) >= $_.msglen) { //#19871
            $j--; //#19871
            $k[$j++] = true; //#19871
        } else { //#19871
            var _8u = $get($k[--$j], $_.ver); //#19871
            $k[$j++] = $lt($get($_.numNs, $f($get($_.nextNs, $_.i) + $_.i)), _8u); //#19871
        } //#19871
    }; //#19871
    if (!bwipp_qrcode.__19901__) { //#19901
        $_ = Object.create($_); //#19901
        $k[$j++] = Infinity; //#19896
        $k[$j++] = "full"; //#19885
        $k[$j++] = Infinity; //#19885
        for (var _8v = 0; _8v <= 9; _8v += 1) { //#19883
            $k[$j++] = $cvrs($s(2), _8v, 10); //#19883
            $k[$j++] = $_.v1to9; //#19883
        } //#19883
        for (var _8z = 10; _8z <= 26; _8z += 1) { //#19884
            $k[$j++] = $cvrs($s(2), _8z, 10); //#19884
            $k[$j++] = $_.v10to26; //#19884
        } //#19884
        for (var _93 = 27; _93 <= 40; _93 += 1) { //#19885
            $k[$j++] = $cvrs($s(2), _93, 10); //#19885
            $k[$j++] = $_.v27to40; //#19885
        } //#19885
        var _97 = $d(); //#19885
        var _9C = new Map([
            ["M1", $_.vM1],
            ["M2", $_.vM2],
            ["M3", $_.vM3],
            ["M4", $_.vM4]
        ]); //#19888
        var _9j = new Map([
            ["R7x43", $_.vR7x43],
            ["R7x59", $_.vR7x59],
            ["R7x77", $_.vR7x77],
            ["R7x99", $_.vR7x99],
            ["R7x139", $_.vR7x139],
            ["R9x43", $_.vR9x43],
            ["R9x59", $_.vR9x59],
            ["R9x77", $_.vR9x77],
            ["R9x99", $_.vR9x99],
            ["R9x139", $_.vR9x139],
            ["R11x27", $_.vR11x27],
            ["R11x43", $_.vR11x43],
            ["R11x59", $_.vR11x59],
            ["R11x77", $_.vR11x77],
            ["R11x99", $_.vR11x99],
            ["R11x139", $_.vR11x139],
            ["R13x27", $_.vR13x27],
            ["R13x43", $_.vR13x43],
            ["R13x59", $_.vR13x59],
            ["R13x77", $_.vR13x77],
            ["R13x99", $_.vR13x99],
            ["R13x139", $_.vR13x139],
            ["R15x43", $_.vR15x43],
            ["R15x59", $_.vR15x59],
            ["R15x77", $_.vR15x77],
            ["R15x99", $_.vR15x99],
            ["R15x139", $_.vR15x139],
            ["R17x43", $_.vR17x43],
            ["R17x59", $_.vR17x59],
            ["R17x77", $_.vR17x77],
            ["R17x99", $_.vR17x99],
            ["R17x139", $_.vR17x139]
        ]); //#19896
        $k[$j++] = _97; //#19896
        $k[$j++] = "micro"; //#19896
        $k[$j++] = _9C; //#19896
        $k[$j++] = "rmqr"; //#19896
        $k[$j++] = _9j; //#19896
        $_.versetmap = $d(); //#19898
        $_.versetfull = $a([$_.v1to9, $_.v10to26, $_.v27to40]); //#19899
        $_.versetmicro = $a([$_.vM1, $_.vM2, $_.vM3, $_.vM4]); //#19900
        for (var id in $_) $_.hasOwnProperty(id) && (bwipp_qrcode.$ctx[id] = $_[id]); //#19900
        bwipp_qrcode.__19901__ = 1; //#19900
        $_ = Object.getPrototypeOf($_); //#19900
    } //#19900
    if ($ne($_.version, "unset")) { //#19919
        var _9y = $get($_.versetmap, $_.format); //#19904
        var _9z = $_.version; //#19904
        var _A0 = $get(_9y, _9z) !== undefined; //#19904
        $k[$j++] = _9y; //#19914
        $k[$j++] = _9z; //#19914
        if (!_A0) { //#19914
            $j -= 2; //#19905
            if ($eq($_.format, "full")) { //#19912
                $k[$j++] = 'bwipp.qrcodeInvalidFullVersion#19907'; //#19907
                $k[$j++] = "Valid versions for QR Code symbols are 1 to 40"; //#19907
                bwipp_raiseerror(); //#19907
            } else { //#19912
                if ($eq($_.format, "micro")) { //#19912
                    $k[$j++] = 'bwipp.qrcodeInvalidMicroVersion#19910'; //#19910
                    $k[$j++] = "Valid versions for Micro QR Code symbols are M1 to M4"; //#19910
                    bwipp_raiseerror(); //#19910
                } else { //#19912
                    $k[$j++] = 'bwipp.qrcodeInvalidRMQRversion#19912'; //#19912
                    $k[$j++] = "Invalid version for an RMQR symbol"; //#19912
                    bwipp_raiseerror(); //#19912
                } //#19912
            } //#19912
        } //#19912
        var _A3 = $k[--$j]; //#19915
        var _A5 = $get($k[--$j], _A3); //#19915
        $k[$j++] = _A5; //#19915
        $k[$j++] = Infinity; //#19915
        var _A6 = $k[--$j]; //#19915
        var _A7 = $k[--$j]; //#19915
        $k[$j++] = _A6; //#19915
        $k[$j++] = _A7; //#19915
        $_.verset = $a(); //#19915
    } else { //#19919
        if ($eq($_.format, "full")) { //#19918
            $_.verset = $_.versetfull; //#19918
        } //#19918
        if ($eq($_.format, "micro")) { //#19919
            $_.verset = $_.versetmicro; //#19919
        } //#19919
    } //#19919
    $k[$j++] = Infinity; //#19924
    for (var _AD = 0, _AE = 39; _AD < _AE; _AD++) { //#19924
        $k[$j++] = -1; //#19924
    } //#19924
    $_.msgbits = $a(); //#19924
    $_.e = 10000; //#19925
    if (!bwipp_qrcode.__19955__) { //#19955
        $_ = Object.create($_); //#19955
        $_.mode0forceKB = $a([1, 1, 1, $_.e, $_.e, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]); //#19931
        $_.mode0forceA = $a([1, 1, 1, $_.e, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]); //#19932
        $_.mode0forceN = $a([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]); //#19933
        $_.mode0NbeforeB = $a([4, 4, 5, $_.e, $_.e, 2, 3, 2, 2, 3, 3, 3, 2, 3, 3, 3, 3, 2, 3, 3, 3, 3, 3, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]); //#19935
        $_.modeBKbeforeB = $a([9, 12, 13, $_.e, $_.e, 4, 6, 4, 5, 6, 6, 6, 5, 6, 6, 6, 7, 4, 6, 6, 6, 7, 7, 5, 6, 6, 7, 7, 7, 6, 6, 7, 7, 7, 6, 7, 7, 7, 8]); //#19937
        $_.modeBKbeforeA = $a([8, 10, 11, $_.e, $_.e, 4, 5, 4, 5, 5, 6, 6, 5, 5, 6, 6, 6, 4, 5, 6, 6, 6, 6, 5, 6, 6, 6, 6, 7, 6, 6, 6, 6, 7, 6, 6, 6, 7, 7]); //#19938
        $_.modeBKbeforeN = $a([8, 9, 11, $_.e, $_.e, 3, 5, 3, 4, 5, 5, 5, 4, 5, 5, 5, 6, 3, 5, 5, 5, 6, 6, 4, 5, 5, 6, 6, 6, 5, 5, 6, 6, 7, 5, 6, 6, 6, 7]); //#19939
        $_.modeBKbeforeE = $a([5, 5, 6, $_.e, $_.e, 2, 3, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 2, 3, 3, 3, 4, 4, 3, 3, 3, 4, 4, 4, 3, 3, 4, 4, 4, 3, 4, 4, 4, 4]); //#19940
        $_.modeBAbeforeK = $a([11, 12, 14, $_.e, $_.e, 5, 7, 5, 6, 7, 8, 8, 6, 7, 8, 8, 8, 6, 7, 8, 8, 8, 8, 6, 8, 8, 8, 8, 9, 8, 8, 8, 8, 9, 8, 8, 8, 9, 9]); //#19942
        $_.modeBAbeforeB = $a([11, 15, 16, $_.e, $_.e, 6, 7, 6, 7, 7, 8, 8, 7, 7, 8, 8, 8, 6, 7, 8, 8, 8, 9, 7, 8, 8, 8, 9, 9, 8, 8, 9, 9, 9, 8, 8, 9, 9, 10]); //#19943
        $_.modeBAbeforeN = $a([12, 13, 15, $_.e, $_.e, 6, 8, 6, 7, 8, 8, 8, 7, 8, 8, 8, 9, 6, 8, 8, 8, 9, 9, 7, 8, 8, 9, 9, 10, 8, 9, 9, 9, 10, 8, 9, 9, 10, 10]); //#19944
        $_.modeBAbeforeE = $a([6, 7, 8, $_.e, $_.e, 3, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 5, 4, 4, 4, 4, 5, 5, 4, 4, 4, 5, 5, 5, 4, 5, 5, 5, 5, 4, 5, 5, 5, 5]); //#19945
        $_.modeBNbeforeK = $a([6, 7, 8, $_.e, $_.e, 3, 4, 3, 4, 4, 5, 5, 4, 4, 5, 5, 5, 3, 4, 5, 5, 5, 5, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]); //#19947
        $_.modeBNbeforeB = $a([6, 8, 9, $_.e, $_.e, 3, 4, 3, 4, 4, 5, 5, 4, 4, 5, 5, 5, 3, 4, 5, 5, 5, 5, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6]); //#19948
        $_.modeBNbeforeA = $a([6, 7, 8, $_.e, $_.e, 3, 4, 3, 4, 4, 5, 5, 4, 4, 5, 5, 5, 4, 4, 5, 5, 5, 5, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 5, 5, 5, 5, 6]); //#19949
        $_.modeBNbeforeE = $a([3, 4, 4, $_.e, $_.e, 2, 3, 2, 2, 3, 3, 3, 2, 3, 3, 3, 3, 2, 3, 3, 3, 3, 3, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]); //#19950
        $_.modeANbeforeA = $a([13, 15, 17, $_.e, 5, 7, 9, 7, 8, 9, 9, 9, 8, 9, 9, 9, 11, 7, 9, 9, 9, 11, 11, 8, 9, 9, 10, 11, 11, 9, 10, 11, 11, 11, 9, 11, 11, 11, 11]); //#19952
        $_.modeANbeforeB = $a([13, 17, 18, $_.e, $_.e, 7, 9, 7, 8, 9, 9, 9, 8, 9, 9, 9, 10, 7, 9, 9, 9, 10, 11, 8, 9, 9, 9, 11, 11, 9, 9, 11, 11, 11, 9, 10, 11, 11, 11]); //#19953
        $_.modeANbeforeE = $a([7, 8, 9, $_.e, 3, 4, 5, 4, 5, 5, 5, 5, 5, 5, 5, 5, 6, 4, 5, 5, 5, 6, 6, 5, 5, 5, 5, 6, 6, 5, 5, 6, 6, 6, 5, 6, 6, 6, 6]); //#19954
        for (var id in $_) $_.hasOwnProperty(id) && (bwipp_qrcode.$ctx[id] = $_[id]); //#19954
        bwipp_qrcode.__19955__ = 1; //#19954
        $_ = Object.getPrototypeOf($_); //#19954
    } //#19954
    var _B7 = $_.verset; //#19957
    for (var _B8 = 0, _B9 = _B7.length; _B8 < _B9; _B8++) { //#20089
        $_.ver = $get(_B7, _B8); //#19958
        $_.mode = -1; //#19961
        $_.seq = $a([]); //#19961
        $_.i = 0; //#19961
        for (;;) { //#20058
            if ($_.i >= $_.msglen) { //#19962
                break; //#19962
            } //#19962
            $_.numK = $get($_.numKs, $_.i); //#19963
            $_.numB = $get($_.numBs, $_.i); //#19964
            $_.numA = $get($_.numAs, $_.i); //#19965
            $_.numN = $get($_.numNs, $_.i); //#19966
            $_.numAorN = $get($_.numAorNs, $_.i); //#19967
            $_.eci = $get($_.isECI, $_.i); //#19968
            if ($eq($_.ver, $_.vM1) && ($_.numA >= 1)) { //#19969
                $_.seq = -1; //#19969
                break; //#19969
            } //#19969
            if ($eq($_.ver, $_.vM1) && ($_.numB >= 1)) { //#19970
                $_.seq = -1; //#19970
                break; //#19970
            } //#19970
            if ($eq($_.ver, $_.vM1) && ($_.numK >= 1)) { //#19971
                $_.seq = -1; //#19971
                break; //#19971
            } //#19971
            if ($eq($_.ver, $_.vM1) && $_.eci) { //#19972
                $_.seq = -1; //#19972
                break; //#19972
            } //#19972
            if ($eq($_.ver, $_.vM2) && ($_.numB >= 1)) { //#19973
                $_.seq = -1; //#19973
                break; //#19973
            } //#19973
            if ($eq($_.ver, $_.vM2) && ($_.numK >= 1)) { //#19974
                $_.seq = -1; //#19974
                break; //#19974
            } //#19974
            if ($eq($_.ver, $_.vM2) && $_.eci) { //#19975
                $_.seq = -1; //#19975
                break; //#19975
            } //#19975
            if ($eq($_.ver, $_.vM3) && $_.eci) { //#19976
                $_.seq = -1; //#19976
                break; //#19976
            } //#19976
            if ($eq($_.ver, $_.vM4) && $_.eci) { //#19977
                $_.seq = -1; //#19977
                break; //#19977
            } //#19977
            for (;;) { //#20038
                if ($_.eci) { //#19981
                    $k[$j++] = $_.E; //#19980
                    break; //#19980
                } //#19980
                if ($_.mode == -1) { //#19996
                    $k[$j++] = $_.mode0forceKB; //#19983
                    $_.KbeforeA(); //#19983
                    if ($k[--$j]) { //#19983
                        $k[$j++] = $_.K; //#19983
                        break; //#19983
                    } //#19983
                    $k[$j++] = $_.mode0forceKB; //#19984
                    $_.KbeforeN(); //#19984
                    if ($k[--$j]) { //#19984
                        $k[$j++] = $_.K; //#19984
                        break; //#19984
                    } //#19984
                    $k[$j++] = $_.modeBKbeforeE; //#19985
                    $_.KbeforeB(); //#19985
                    if ($k[--$j]) { //#19985
                        $k[$j++] = $_.K; //#19985
                        break; //#19985
                    } //#19985
                    $k[$j++] = $_.mode0forceKB; //#19986
                    $_.KbeforeE(); //#19986
                    if ($k[--$j]) { //#19986
                        $k[$j++] = $_.K; //#19986
                        break; //#19986
                    } //#19986
                    if ($_.numK >= 1) { //#19987
                        $k[$j++] = $_.B; //#19987
                        break; //#19987
                    } //#19987
                    $k[$j++] = $_.mode0NbeforeB; //#19988
                    $_.NbeforeB(); //#19988
                    if ($k[--$j]) { //#19988
                        $k[$j++] = $_.N; //#19988
                        break; //#19988
                    } //#19988
                    $k[$j++] = $_.mode0forceKB; //#19989
                    $_.NbeforeB(); //#19989
                    if ($k[--$j]) { //#19989
                        $k[$j++] = $_.B; //#19989
                        break; //#19989
                    } //#19989
                    $k[$j++] = $_.modeANbeforeE; //#19990
                    $_.NbeforeA(); //#19990
                    if ($k[--$j]) { //#19990
                        $k[$j++] = $_.N; //#19990
                        break; //#19990
                    } //#19990
                    $k[$j++] = $_.mode0forceN; //#19991
                    $_.NbeforeE(); //#19991
                    if ($k[--$j]) { //#19991
                        $k[$j++] = $_.N; //#19991
                        break; //#19991
                    } //#19991
                    $k[$j++] = $_.modeBAbeforeE; //#19992
                    $_.AbeforeK(); //#19992
                    if ($k[--$j]) { //#19992
                        $k[$j++] = $_.A; //#19992
                        break; //#19992
                    } //#19992
                    $k[$j++] = $_.modeBAbeforeE; //#19993
                    $_.AorNbeforeB(); //#19993
                    if ($k[--$j]) { //#19993
                        $k[$j++] = $_.A; //#19993
                        break; //#19993
                    } //#19993
                    $k[$j++] = $_.mode0forceA; //#19994
                    $_.AorNbeforeE(); //#19994
                    if ($k[--$j]) { //#19994
                        $k[$j++] = $_.A; //#19994
                        break; //#19994
                    } //#19994
                    $k[$j++] = $_.B; //#19995
                    break; //#19995
                } //#19995
                if ($_.mode == $_.B) { //#20014
                    $k[$j++] = $_.modeBKbeforeB; //#19998
                    $_.KbeforeB(); //#19998
                    if ($k[--$j]) { //#19998
                        $k[$j++] = $_.K; //#19998
                        break; //#19998
                    } //#19998
                    $k[$j++] = $_.modeBKbeforeA; //#19999
                    $_.KbeforeA(); //#19999
                    if ($k[--$j]) { //#19999
                        $k[$j++] = $_.K; //#19999
                        break; //#19999
                    } //#19999
                    $k[$j++] = $_.modeBKbeforeN; //#20000
                    $_.KbeforeN(); //#20000
                    if ($k[--$j]) { //#20000
                        $k[$j++] = $_.K; //#20000
                        break; //#20000
                    } //#20000
                    $k[$j++] = $_.modeBKbeforeE; //#20001
                    $_.KbeforeE(); //#20001
                    if ($k[--$j]) { //#20001
                        $k[$j++] = $_.K; //#20001
                        break; //#20001
                    } //#20001
                    $k[$j++] = $_.modeBAbeforeK; //#20002
                    $_.AbeforeK(); //#20002
                    if ($k[--$j]) { //#20002
                        $k[$j++] = $_.A; //#20002
                        break; //#20002
                    } //#20002
                    $k[$j++] = $_.modeBAbeforeB; //#20003
                    $_.AbeforeB(); //#20003
                    if ($k[--$j]) { //#20003
                        $k[$j++] = $_.A; //#20003
                        break; //#20003
                    } //#20003
                    $k[$j++] = $_.modeBAbeforeN; //#20004
                    $_.AbeforeN(); //#20004
                    if ($k[--$j]) { //#20004
                        $k[$j++] = $_.A; //#20004
                        break; //#20004
                    } //#20004
                    $k[$j++] = $_.modeBAbeforeE; //#20005
                    $_.AbeforeE(); //#20005
                    if ($k[--$j]) { //#20005
                        $k[$j++] = $_.A; //#20005
                        break; //#20005
                    } //#20005
                    $k[$j++] = $_.modeBNbeforeK; //#20006
                    $_.NbeforeK(); //#20006
                    if ($k[--$j]) { //#20006
                        $k[$j++] = $_.N; //#20006
                        break; //#20006
                    } //#20006
                    $k[$j++] = $_.modeBNbeforeB; //#20007
                    $_.NbeforeB(); //#20007
                    if ($k[--$j]) { //#20007
                        $k[$j++] = $_.N; //#20007
                        break; //#20007
                    } //#20007
                    $k[$j++] = $_.modeBNbeforeA; //#20008
                    $_.NbeforeA(); //#20008
                    if ($k[--$j]) { //#20008
                        $k[$j++] = $_.N; //#20008
                        break; //#20008
                    } //#20008
                    $k[$j++] = $_.modeBNbeforeE; //#20009
                    $_.NbeforeE(); //#20009
                    if ($k[--$j]) { //#20009
                        $k[$j++] = $_.N; //#20009
                        break; //#20009
                    } //#20009
                    $k[$j++] = $_.modeBAbeforeE; //#20010
                    $_.AorNbeforeE(); //#20010
                    var _DH = $k[--$j]; //#20010
                    if (_DH && $le($_.numAorN, $get($_.modeBAbeforeN, $_.ver))) { //#20012
                        $k[$j++] = $_.modeBNbeforeA; //#20011
                        $_.nextNslt(); //#20011
                        if ($k[--$j]) { //#20011
                            $k[$j++] = $_.A; //#20011
                            break; //#20011
                        } //#20011
                    } //#20011
                    $k[$j++] = $_.B; //#20013
                    break; //#20013
                } //#20013
                if ($_.mode == $_.A) { //#20023
                    if ($_.numK >= 1) { //#20016
                        $k[$j++] = $_.K; //#20016
                        break; //#20016
                    } //#20016
                    if ($_.numB >= 1) { //#20017
                        $k[$j++] = $_.B; //#20017
                        break; //#20017
                    } //#20017
                    $k[$j++] = $_.modeANbeforeA; //#20018
                    $_.NbeforeA(); //#20018
                    if ($k[--$j]) { //#20018
                        $k[$j++] = $_.N; //#20018
                        break; //#20018
                    } //#20018
                    $k[$j++] = $_.modeANbeforeB; //#20019
                    $_.NbeforeB(); //#20019
                    if ($k[--$j]) { //#20019
                        $k[$j++] = $_.N; //#20019
                        break; //#20019
                    } //#20019
                    $k[$j++] = $_.modeANbeforeE; //#20020
                    $_.NbeforeE(); //#20020
                    if ($k[--$j]) { //#20020
                        $k[$j++] = $_.N; //#20020
                        break; //#20020
                    } //#20020
                    if (($_.numA >= 1) || ($_.numN >= 1)) { //#20021
                        $k[$j++] = $_.A; //#20021
                        break; //#20021
                    } //#20021
                    $k[$j++] = $_.B; //#20022
                    break; //#20022
                } //#20022
                if ($_.mode == $_.N) { //#20030
                    if ($_.numK >= 1) { //#20025
                        $k[$j++] = $_.K; //#20025
                        break; //#20025
                    } //#20025
                    if ($_.numB >= 1) { //#20026
                        $k[$j++] = $_.B; //#20026
                        break; //#20026
                    } //#20026
                    if ($_.numA >= 1) { //#20027
                        $k[$j++] = $_.A; //#20027
                        break; //#20027
                    } //#20027
                    if ($_.numN >= 1) { //#20028
                        $k[$j++] = $_.N; //#20028
                        break; //#20028
                    } //#20028
                    $k[$j++] = $_.B; //#20029
                    break; //#20029
                } //#20029
                if ($_.mode == $_.K) { //#20037
                    if ($_.numB >= 1) { //#20032
                        $k[$j++] = $_.B; //#20032
                        break; //#20032
                    } //#20032
                    if ($_.numA >= 1) { //#20033
                        $k[$j++] = $_.A; //#20033
                        break; //#20033
                    } //#20033
                    if ($_.numN >= 1) { //#20034
                        $k[$j++] = $_.N; //#20034
                        break; //#20034
                    } //#20034
                    if ($_.numK >= 1) { //#20035
                        $k[$j++] = $_.K; //#20035
                        break; //#20035
                    } //#20035
                    $k[$j++] = $_.B; //#20036
                    break; //#20036
                } //#20036
            } //#20036
            var _E1 = $k[--$j]; //#20039
            $k[$j++] = _E1; //#20039
            if ((_E1 == $_.K) && $_.fnc1first) { //#20039
                $j--; //#20039
                $k[$j++] = $_.B; //#20039
            } //#20039
            var _E5 = $k[--$j]; //#20040
            $k[$j++] = _E5; //#20056
            if (_E5 == $_.mode) { //#20055
                $j--; //#20041
                var _EB = ($_.mode == $_.K) ? 2 : 1; //#20042
                $_.dat = $geti($_.msg, $_.i, _EB); //#20042
                $k[$j++] = Infinity; //#20045
                $aload($_.seq); //#20044
                $k[$j++] = Infinity; //#20045
                var _EE = $k[--$j]; //#20045
                var _EF = $k[--$j]; //#20045
                $k[$j++] = _EE; //#20045
                $aload(_EF); //#20045
                $aload($_.dat); //#20045
                var _EH = $a(); //#20045
                $k[$j++] = _EH; //#20045
                $_.seq = $a(); //#20045
            } else { //#20055
                $_.mode = $k[--$j]; //#20048
                if ($_.mode == $_.K) { //#20049
                    $k[$j++] = $_.K; //#20049
                    $k[$j++] = $geti($_.msg, $_.i, $_.numK * 2); //#20049
                } //#20049
                if ($_.mode == $_.B) { //#20050
                    $k[$j++] = $_.B; //#20050
                    $k[$j++] = $geti($_.msg, $_.i, $_.numB); //#20050
                } //#20050
                if ($_.mode == $_.A) { //#20051
                    $k[$j++] = $_.A; //#20051
                    $k[$j++] = $geti($_.msg, $_.i, $_.numA); //#20051
                } //#20051
                if ($_.mode == $_.N) { //#20052
                    $k[$j++] = $_.N; //#20052
                    $k[$j++] = $geti($_.msg, $_.i, $_.numN); //#20052
                } //#20052
                if ($_.mode == $_.E) { //#20053
                    $_.mode = -1; //#20053
                    $k[$j++] = $_.E; //#20053
                    $k[$j++] = $geti($_.msg, $_.i, 1); //#20053
                } //#20053
                $_.dat = $k[--$j]; //#20054
                $_.sw = $k[--$j]; //#20054
                $k[$j++] = Infinity; //#20055
                $aload($_.seq); //#20055
                $k[$j++] = $_.sw; //#20055
                $k[$j++] = $_.dat; //#20055
                $_.seq = $a(); //#20055
            } //#20055
            $_.i = $_.i + $_.dat.length; //#20057
        } //#20057
        for (;;) { //#20088
            if ($_.seq == -1) { //#20062
                break; //#20062
            } //#20062
            $_.bits = $s(23648); //#20063
            $_.j = 0; //#20064
            if ($_.fnc1first) { //#20067
                if ($lt($_.ver, $_.vR7x43)) { //#20066
                    $k[$j++] = "0101"; //#20066
                } else { //#20066
                    $k[$j++] = "101"; //#20066
                } //#20066
                $_.addtobits(); //#20066
            } //#20066
            $_.abort = false; //#20068
            for (var _F7 = 0, _F6 = $_.seq.length - 1; _F7 <= _F6; _F7 += 2) { //#20083
                $_.i = _F7; //#20070
                $_.mode = $get($_.seq, $_.i); //#20071
                $k[$j++] = $get($get($_.mids, $_.ver), $_.mode); //#20072
                $_.addtobits(); //#20072
                $_.chars = $get($_.seq, $_.i + 1); //#20073
                $k[$j++] = 'charslen'; //#20074
                $k[$j++] = $_.chars.length; //#20074
                if ($_.mode == $_.K) { //#20074
                    var _FM = $k[--$j]; //#20074
                    $k[$j++] = ~~(_FM / 2); //#20074
                } //#20074
                var _FN = $k[--$j]; //#20074
                $_[$k[--$j]] = _FN; //#20074
                if ($_.mode != $_.E) { //#20081
                    $_.cclen = $get($get($_.cclens, $_.ver), $_.mode); //#20076
                    if ($_.charslen >= (~~Math.pow(2, $_.cclen))) { //#20079
                        $_.abort = true; //#20078
                        break; //#20078
                    } //#20078
                    $k[$j++] = $_.charslen; //#20080
                    $k[$j++] = $_.cclen; //#20080
                    $_.tobin(); //#20080
                    $_.addtobits(); //#20080
                } //#20080
                $k[$j++] = $_.chars; //#20082
                if ($_[$get($_.encfuncs, $_.mode)]() === true) {
                    break;
                } //#20082
                $_.addtobits(); //#20082
            } //#20082
            if ($_.abort) { //#20084
                break; //#20084
            } //#20084
            $_.bits = $geti($_.bits, 0, $_.j); //#20085
            $put($_.msgbits, $_.ver, $_.bits); //#20086
            break; //#20087
        } //#20087
    } //#20087
    if (!bwipp_qrcode.__20173__) { //#20173
        $_ = Object.create($_); //#20173
        $_.metrics = $a([$a(["micro", "M1", $_.vM1, 11, 11, 98, 99, 36, $a([2, 99, 99, 99]), $a([1, 0, -1, -1, -1, -1, -1, -1])]), $a(["micro", "M2", $_.vM2, 13, 13, 98, 99, 80, $a([5, 6, 99, 99]), $a([1, 0, 1, 0, -1, -1, -1, -1])]), $a(["micro", "M3", $_.vM3, 15, 15, 98, 99, 132, $a([6, 8, 99, 99]), $a([1, 0, 1, 0, -1, -1, -1, -1])]), $a(["micro", "M4", $_.vM4, 17, 17, 98, 99, 192, $a([8, 10, 14, 99]), $a([1, 0, 1, 0, 1, 0, -1, -1])]), $a(["full", "1", $_.v1to9, 21, 21, 98, 99, 208, $a([7, 10, 13, 17]), $a([1, 0, 1, 0, 1, 0, 1, 0])]), $a(["full", "2", $_.v1to9, 25, 25, 18, 99, 359, $a([10, 16, 22, 28]), $a([1, 0, 1, 0, 1, 0, 1, 0])]), $a(["full", "3", $_.v1to9, 29, 29, 22, 99, 567, $a([15, 26, 36, 44]), $a([1, 0, 1, 0, 2, 0, 2, 0])]), $a(["full", "4", $_.v1to9, 33, 33, 26, 99, 807, $a([20, 36, 52, 64]), $a([1, 0, 2, 0, 2, 0, 4, 0])]), $a(["full", "5", $_.v1to9, 37, 37, 30, 99, 1079, $a([26, 48, 72, 88]), $a([1, 0, 2, 0, 2, 2, 2, 2])]), $a(["full", "6", $_.v1to9, 41, 41, 34, 99, 1383, $a([36, 64, 96, 112]), $a([2, 0, 4, 0, 4, 0, 4, 0])]), $a(["full", "7", $_.v1to9, 45, 45, 22, 38, 1568, $a([40, 72, 108, 130]), $a([2, 0, 4, 0, 2, 4, 4, 1])]), $a(["full", "8", $_.v1to9, 49, 49, 24, 42, 1936, $a([48, 88, 132, 156]), $a([2, 0, 2, 2, 4, 2, 4, 2])]), $a(["full", "9", $_.v1to9, 53, 53, 26, 46, 2336, $a([60, 110, 160, 192]), $a([2, 0, 3, 2, 4, 4, 4, 4])]), $a(["full", "10", $_.v10to26, 57, 57, 28, 50, 2768, $a([72, 130, 192, 224]), $a([2, 2, 4, 1, 6, 2, 6, 2])]), $a(["full", "11", $_.v10to26, 61, 61, 30, 54, 3232, $a([80, 150, 224, 264]), $a([4, 0, 1, 4, 4, 4, 3, 8])]), $a(["full", "12", $_.v10to26, 65, 65, 32, 58, 3728, $a([96, 176, 260, 308]), $a([2, 2, 6, 2, 4, 6, 7, 4])]), $a(["full", "13", $_.v10to26, 69, 69, 34, 62, 4256, $a([104, 198, 288, 352]), $a([4, 0, 8, 1, 8, 4, 12, 4])]), $a(["full", "14", $_.v10to26, 73, 73, 26, 46, 4651, $a([120, 216, 320, 384]), $a([3, 1, 4, 5, 11, 5, 11, 5])]), $a(["full", "15", $_.v10to26, 77, 77, 26, 48, 5243, $a([132, 240, 360, 432]), $a([5, 1, 5, 5, 5, 7, 11, 7])]), $a(["full", "16", $_.v10to26, 81, 81, 26, 50, 5867, $a([144, 280, 408, 480]), $a([5, 1, 7, 3, 15, 2, 3, 13])]), $a(["full", "17", $_.v10to26, 85, 85, 30, 54, 6523, $a([168, 308, 448, 532]), $a([1, 5, 10, 1, 1, 15, 2, 17])]), $a(["full", "18", $_.v10to26, 89, 89, 30, 56, 7211, $a([180, 338, 504, 588]), $a([5, 1, 9, 4, 17, 1, 2, 19])]), $a(["full", "19", $_.v10to26, 93, 93, 30, 58, 7931, $a([196, 364, 546, 650]), $a([3, 4, 3, 11, 17, 4, 9, 16])]), $a(["full", "20", $_.v10to26, 97, 97, 34, 62, 8683, $a([224, 416, 600, 700]), $a([3, 5, 3, 13, 15, 5, 15, 10])]), $a(["full", "21", $_.v10to26, 101, 101, 28, 50, 9252, $a([224, 442, 644, 750]), $a([4, 4, 17, 0, 17, 6, 19, 6])]), $a(["full", "22", $_.v10to26, 105, 105, 26, 50, 10068, $a([252, 476, 690, 816]), $a([2, 7, 17, 0, 7, 16, 34, 0])]), $a(["full", "23", $_.v10to26, 109, 109, 30, 54, 10916, $a([270, 504, 750, 900]), $a([4, 5, 4, 14, 11, 14, 16, 14])]), $a(["full", "24", $_.v10to26, 113, 113, 28, 54, 11796, $a([300, 560, 810, 960]), $a([6, 4, 6, 14, 11, 16, 30, 2])]), $a(["full", "25", $_.v10to26, 117, 117, 32, 58, 12708, $a([312, 588, 870, 1050]), $a([8, 4, 8, 13, 7, 22, 22, 13])]), $a(["full", "26", $_.v10to26, 121, 121, 30, 58, 13652, $a([336, 644, 952, 1110]), $a([10, 2, 19, 4, 28, 6, 33, 4])]), $a(["full", "27", $_.v27to40, 125, 125, 34, 62, 14628, $a([360, 700, 1020, 1200]), $a([8, 4, 22, 3, 8, 26, 12, 28])]), $a(["full", "28", $_.v27to40, 129, 129, 26, 50, 15371, $a([390, 728, 1050, 1260]), $a([3, 10, 3, 23, 4, 31, 11, 31])]), $a(["full", "29", $_.v27to40, 133, 133, 30, 54, 16411, $a([420, 784, 1140, 1350]), $a([7, 7, 21, 7, 1, 37, 19, 26])]), $a(["full", "30", $_.v27to40, 137, 137, 26, 52, 17483, $a([450, 812, 1200, 1440]), $a([5, 10, 19, 10, 15, 25, 23, 25])]), $a(["full", "31", $_.v27to40, 141, 141, 30, 56, 18587, $a([480, 868, 1290, 1530]), $a([13, 3, 2, 29, 42, 1, 23, 28])]), $a(["full", "32", $_.v27to40, 145, 145, 34, 60, 19723, $a([510, 924, 1350, 1620]), $a([17, 0, 10, 23, 10, 35, 19, 35])]), $a(["full", "33", $_.v27to40, 149, 149, 30, 58, 20891, $a([540, 980, 1440, 1710]), $a([17, 1, 14, 21, 29, 19, 11, 46])]), $a(["full", "34", $_.v27to40, 153, 153, 34, 62, 22091, $a([570, 1036, 1530, 1800]), $a([13, 6, 14, 23, 44, 7, 59, 1])]), $a(["full", "35", $_.v27to40, 157, 157, 30, 54, 23008, $a([570, 1064, 1590, 1890]), $a([12, 7, 12, 26, 39, 14, 22, 41])]), $a(["full", "36", $_.v27to40, 161, 161, 24, 50, 24272, $a([600, 1120, 1680, 1980]), $a([6, 14, 6, 34, 46, 10, 2, 64])]), $a(["full", "37", $_.v27to40, 165, 165, 28, 54, 25568, $a([630, 1204, 1770, 2100]), $a([17, 4, 29, 14, 49, 10, 24, 46])]), $a(["full", "38", $_.v27to40, 169, 169, 32, 58, 26896, $a([660, 1260, 1860, 2220]), $a([4, 18, 13, 32, 48, 14, 42, 32])]), $a(["full", "39", $_.v27to40, 173, 173, 26, 54, 28256, $a([720, 1316, 1950, 2310]), $a([20, 4, 40, 7, 43, 22, 10, 67])]), $a(["full", "40", $_.v27to40, 177, 177, 30, 58, 29648, $a([750, 1372, 2040, 2430]), $a([19, 6, 18, 31, 34, 34, 20, 61])]), $a(["rmqr", "R7x43", $_.vR7x43, 7, 43, 22, 99, 104, $a([99, 7, 99, 10]), $a([-1, -1, 1, 0, -1, -1, 1, 0])]), $a(["rmqr", "R7x59", $_.vR7x59, 7, 59, 20, 40, 171, $a([99, 9, 99, 14]), $a([-1, -1, 1, 0, -1, -1, 1, 0])]), $a(["rmqr", "R7x77", $_.vR7x77, 7, 77, 26, 52, 261, $a([99, 12, 99, 22]), $a([-1, -1, 1, 0, -1, -1, 1, 0])]), $a(["rmqr", "R7x99", $_.vR7x99, 7, 99, 24, 50, 358, $a([99, 16, 99, 30]), $a([-1, -1, 1, 0, -1, -1, 1, 0])]), $a(["rmqr", "R7x139", $_.vR7x139, 7, 139, 28, 56, 545, $a([99, 24, 99, 44]), $a([-1, -1, 1, 0, -1, -1, 2, 0])]), $a(["rmqr", "R9x43", $_.vR9x43, 9, 43, 22, 99, 170, $a([99, 9, 99, 14]), $a([-1, -1, 1, 0, -1, -1, 1, 0])]), $a(["rmqr", "R9x59", $_.vR9x59, 9, 59, 20, 40, 267, $a([99, 12, 99, 22]), $a([-1, -1, 1, 0, -1, -1, 1, 0])]), $a(["rmqr", "R9x77", $_.vR9x77, 9, 77, 26, 52, 393, $a([99, 18, 99, 32]), $a([-1, -1, 1, 0, -1, -1, 1, 1])]), $a(["rmqr", "R9x99", $_.vR9x99, 9, 99, 24, 50, 532, $a([99, 24, 99, 44]), $a([-1, -1, 1, 0, -1, -1, 2, 0])]), $a(["rmqr", "R9x139", $_.vR9x139, 9, 139, 28, 56, 797, $a([99, 36, 99, 66]), $a([-1, -1, 1, 1, -1, -1, 3, 0])]), $a(["rmqr", "R11x27", $_.vR11x27, 11, 27, 98, 99, 122, $a([99, 8, 99, 10]), $a([-1, -1, 1, 0, -1, -1, 1, 0])]), $a(["rmqr", "R11x43", $_.vR11x43, 11, 43, 22, 99, 249, $a([99, 12, 99, 20]), $a([-1, -1, 1, 0, -1, -1, 1, 0])]), $a(["rmqr", "R11x59", $_.vR11x59, 11, 59, 20, 40, 376, $a([99, 16, 99, 32]), $a([-1, -1, 1, 0, -1, -1, 1, 1])]), $a(["rmqr", "R11x77", $_.vR11x77, 11, 77, 26, 52, 538, $a([99, 24, 99, 44]), $a([-1, -1, 1, 0, -1, -1, 1, 1])]), $a(["rmqr", "R11x99", $_.vR11x99, 11, 99, 24, 50, 719, $a([99, 32, 99, 60]), $a([-1, -1, 1, 1, -1, -1, 1, 1])]), $a(["rmqr", "R11x139", $_.vR11x139, 11, 139, 28, 56, 1062, $a([99, 48, 99, 90]), $a([-1, -1, 2, 0, -1, -1, 3, 0])]), $a(["rmqr", "R13x27", $_.vR13x27, 13, 27, 98, 99, 172, $a([99, 9, 99, 14]), $a([-1, -1, 1, 0, -1, -1, 1, 0])]), $a(["rmqr", "R13x43", $_.vR13x43, 13, 43, 22, 99, 329, $a([99, 14, 99, 28]), $a([-1, -1, 1, 0, -1, -1, 1, 0])]), $a(["rmqr", "R13x59", $_.vR13x59, 13, 59, 20, 40, 486, $a([99, 22, 99, 40]), $a([-1, -1, 1, 0, -1, -1, 2, 0])]), $a(["rmqr", "R13x77", $_.vR13x77, 13, 77, 26, 52, 684, $a([99, 32, 99, 56]), $a([-1, -1, 1, 1, -1, -1, 1, 1])]), $a(["rmqr", "R13x99", $_.vR13x99, 13, 99, 24, 50, 907, $a([99, 40, 99, 78]), $a([-1, -1, 1, 1, -1, -1, 1, 2])]), $a(["rmqr", "R13x139", $_.vR13x139, 13, 139, 28, 56, 1328, $a([99, 60, 99, 112]), $a([-1, -1, 2, 1, -1, -1, 2, 2])]), $a(["rmqr", "R15x43", $_.vR15x43, 15, 43, 22, 99, 409, $a([99, 18, 99, 36]), $a([-1, -1, 1, 0, -1, -1, 1, 1])]), $a(["rmqr", "R15x59", $_.vR15x59, 15, 59, 20, 40, 596, $a([99, 26, 99, 48]), $a([-1, -1, 1, 0, -1, -1, 2, 0])]), $a(["rmqr", "R15x77", $_.vR15x77, 15, 77, 26, 52, 830, $a([99, 36, 99, 72]), $a([-1, -1, 1, 1, -1, -1, 2, 1])]), $a(["rmqr", "R15x99", $_.vR15x99, 15, 99, 24, 50, 1095, $a([99, 48, 99, 88]), $a([-1, -1, 2, 0, -1, -1, 4, 0])]), $a(["rmqr", "R15x139", $_.vR15x139, 15, 139, 28, 56, 1594, $a([99, 72, 99, 130]), $a([-1, -1, 2, 1, -1, -1, 1, 4])]), $a(["rmqr", "R17x43", $_.vR17x43, 17, 43, 22, 99, 489, $a([99, 22, 99, 40]), $a([-1, -1, 1, 0, -1, -1, 1, 1])]), $a(["rmqr", "R17x59", $_.vR17x59, 17, 59, 20, 40, 706, $a([99, 32, 99, 60]), $a([-1, -1, 2, 0, -1, -1, 2, 0])]), $a(["rmqr", "R17x77", $_.vR17x77, 17, 77, 26, 52, 976, $a([99, 44, 99, 84]), $a([-1, -1, 2, 0, -1, -1, 1, 2])]), $a(["rmqr", "R17x99", $_.vR17x99, 17, 99, 24, 50, 1283, $a([99, 60, 99, 104]), $a([-1, -1, 2, 1, -1, -1, 4, 0])]), $a(["rmqr", "R17x139", $_.vR17x139, 17, 139, 28, 56, 1860, $a([99, 80, 99, 156]), $a([-1, -1, 4, 0, -1, -1, 2, 4])])]); //#20172
        for (var id in $_) $_.hasOwnProperty(id) && (bwipp_qrcode.$ctx[id] = $_[id]); //#20172
        bwipp_qrcode.__20173__ = 1; //#20172
        $_ = Object.getPrototypeOf($_); //#20172
    } //#20172
    $k[$j++] = 'eclval'; //#20175
    $search("LMQH", $_.eclevel); //#20175
    $j--; //#20175
    var _Kj = $k[--$j]; //#20175
    var _Kk = $k[--$j]; //#20175
    $k[$j++] = _Kj.length; //#20175
    $k[$j++] = _Kk; //#20175
    $j--; //#20175
    var _Kl = $k[--$j]; //#20175
    var _Km = $k[--$j]; //#20175
    $k[$j++] = _Kl; //#20175
    $k[$j++] = _Km; //#20175
    $j--; //#20175
    var _Kn = $k[--$j]; //#20175
    $_[$k[--$j]] = _Kn; //#20175
    for (var _Kr = 0, _Kq = $_.metrics.length - 1; _Kr <= _Kq; _Kr += 1) { //#20214
        $_.i = _Kr; //#20177
        $_.m = $get($_.metrics, $_.i); //#20178
        $_.frmt = $get($_.m, 0); //#20179
        $_.vers = $get($_.m, 1); //#20180
        $_.vergrp = $get($_.m, 2); //#20181
        $_.verind = $_.i - 44; //#20182
        $_.rows = $get($_.m, 3); //#20183
        $_.cols = $get($_.m, 4); //#20184
        $_.asp2 = $get($_.m, 5); //#20185
        $_.asp3 = $get($_.m, 6); //#20186
        $_.nmod = $get($_.m, 7); //#20187
        $_.ncws = ~~($_.nmod / 8); //#20188
        $_.rbit = $_.nmod % 8; //#20189
        $_.lc4b = false; //#20190
        if ($eq($_.vers, "M1") || $eq($_.vers, "M3")) { //#20195
            $_.ncws = $_.ncws + 1; //#20192
            $_.rbit = 0; //#20193
            $_.lc4b = true; //#20194
        } //#20194
        $_.ecws = $get($get($_.m, 8), $_.eclval); //#20196
        $_.dcws = $f($_.ncws - $_.ecws); //#20197
        var _LP = $_.lc4b ? 4 : 0; //#20198
        $_.dmod = $f(($_.dcws * 8) - _LP); //#20198
        $_.ecb1 = $get($get($_.m, 9), $_.eclval * 2); //#20199
        $_.ecb2 = $get($get($_.m, 9), $f(($_.eclval * 2) + 1)); //#20200
        $_.okay = true; //#20201
        if ($ne($_.format, $_.frmt)) { //#20202
            $_.okay = false; //#20202
        } //#20202
        if ($eq($_.frmt, "micro") && $_.fnc1first) { //#20203
            $_.okay = false; //#20203
        } //#20203
        if ($ne($_.version, "unset") && $ne($_.version, $_.vers)) { //#20204
            $_.okay = false; //#20204
        } //#20204
        if (($_.ecb1 == -1) || ($_.ecb2 == -1)) { //#20205
            $_.okay = false; //#20205
        } //#20205
        $_.verbits = $get($_.msgbits, $_.vergrp); //#20206
        if ($_.verbits == -1) { //#20210
            $_.okay = false; //#20208
        } else { //#20210
            if ($_.verbits.length > $_.dmod) { //#20210
                $_.okay = false; //#20210
            } //#20210
        } //#20210
        $_.term = $geti("000000000", 0, $get($_.termlens, $_.vergrp)); //#20212
        if ($_.okay) { //#20213
            break; //#20213
        } //#20213
    } //#20213
    if (!$_.okay) { //#20218
        $k[$j++] = 'bwipp.qrcodeNoValidSymbol#20217'; //#20217
        $k[$j++] = "Maximum length exceeded or invalid content"; //#20217
        bwipp_raiseerror(); //#20217
    } //#20217
    $_.format = $_.frmt; //#20220
    $_.version = $_.vers; //#20221
    $_.msgbits = $_.verbits; //#20222
    $_.dcpb = ~~($_.dcws / $f($_.ecb1 + $_.ecb2)); //#20223
    $_.ecpb = (~~($_.ncws / $f($_.ecb1 + $_.ecb2))) - $_.dcpb; //#20224
    var _M3 = $_.term; //#20227
    var _M4 = $_.dmod; //#20227
    var _M5 = $_.msgbits; //#20227
    var _M6 = $_.term; //#20227
    var _M7 = _M6.length; //#20227
    var _M8 = $f(_M4 - _M5.length); //#20227
    if ($f(_M4 - _M5.length) > _M6.length) { //#20227
        var _ = _M7; //#20227
        _M7 = _M8; //#20227
        _M8 = _; //#20227
    } //#20227
    $_.term = $geti(_M3, 0, _M8); //#20227
    var _MC = $s($_.msgbits.length + $_.term.length); //#20228
    $puti(_MC, 0, $_.msgbits); //#20229
    $puti(_MC, $_.msgbits.length, $_.term); //#20230
    $_.msgbits = _MC; //#20231
    $_.pad = $s($_.dmod); //#20234
    for (var _MK = 0, _MJ = $_.pad.length - 1; _MK <= _MJ; _MK += 1) { //#20235
        $put($_.pad, _MK, 48); //#20235
    } //#20235
    $puti($_.pad, 0, $_.msgbits); //#20236
    $_.padnum = 0; //#20237
    var _MR = $_.lc4b ? 5 : 1; //#20238
    for (var _MT = ~~(Math.ceil($_.msgbits.length / 8) * 8), _MS = $f($_.dmod - _MR); _MT <= _MS; _MT += 8) { //#20241
        $puti($_.pad, _MT, $get($_.padstrs, $_.padnum)); //#20239
        $_.padnum = ($_.padnum + 1) % 2; //#20240
    } //#20240
    $_.cws = $a($_.dcws); //#20244
    for (var _Md = 0, _Mc = $_.cws.length - 1; _Md <= _Mc; _Md += 1) { //#20256
        $_.c = _Md; //#20246
        $_.bpcw = 8; //#20247
        if ($_.lc4b && ($_.c == ($_.cws.length - 1))) { //#20248
            $_.bpcw = 4; //#20248
        } //#20248
        $_.cwb = $geti($_.pad, $_.c * 8, $_.bpcw); //#20249
        $_.cw = 0; //#20250
        for (var _Mn = 0, _Mm = $_.bpcw - 1; _Mn <= _Mm; _Mn += 1) { //#20254
            $_.i = _Mn; //#20252
            $_.cw = $f($_.cw + ((~~(Math.pow(2, ($_.bpcw - $_.i) - 1))) * $f($get($_.cwb, $_.i) - 48))); //#20253
        } //#20253
        $put($_.cws, $_.c, $_.cw); //#20255
    } //#20255
    if ($_.lc4b) { //#20259
        var _My = $_.cws; //#20259
        var _Mz = $_.cws; //#20259
        $put(_My, _Mz.length - 1, $get(_My, _Mz.length - 1) << 4); //#20259
    } //#20259
    var _N2 = $get($_.options, 'debugcws') !== undefined; //#20261
    if (_N2) { //#20261
        $k[$j++] = 'bwipp.debugcws#20261'; //#20261
        $k[$j++] = $_.cws; //#20261
        bwipp_raiseerror(); //#20261
    } //#20261
    if (!bwipp_qrcode.__20268__) { //#20268
        $_ = Object.create($_); //#20268
        $k[$j++] = Infinity; //#20265
        $k[$j++] = 1; //#20265
        for (var _N4 = 0, _N5 = 255; _N4 < _N5; _N4++) { //#20265
            var _N6 = $k[--$j]; //#20265
            var _N7 = _N6 * 2; //#20265
            $k[$j++] = _N6; //#20265
            $k[$j++] = _N7; //#20265
            if (_N7 >= 256) { //#20265
                var _N8 = $k[--$j]; //#20265
                $k[$j++] = _N8 ^ 285; //#20265
            } //#20265
        } //#20265
        $_.rsalog = $a(); //#20265
        $_.rslog = $a(256); //#20266
        for (var _NB = 1; _NB <= 255; _NB += 1) { //#20267
            $put($_.rslog, $get($_.rsalog, _NB), _NB); //#20267
        } //#20267
        for (var id in $_) $_.hasOwnProperty(id) && (bwipp_qrcode.$ctx[id] = $_[id]); //#20267
        bwipp_qrcode.__20268__ = 1; //#20267
        $_ = Object.getPrototypeOf($_); //#20267
    } //#20267
    $_.rsprod = function() {
        var _NG = $k[--$j]; //#20272
        var _NH = $k[--$j]; //#20272
        $k[$j++] = _NH; //#20276
        $k[$j++] = _NG; //#20276
        if ((_NG != 0) && (_NH != 0)) { //#20275
            var _NK = $get($_.rslog, $k[--$j]); //#20273
            var _NP = $get($_.rsalog, $f(_NK + $get($_.rslog, $k[--$j])) % 255); //#20273
            $k[$j++] = _NP; //#20273
        } else { //#20275
            $j -= 2; //#20275
            $k[$j++] = 0; //#20275
        } //#20275
    }; //#20275
    $k[$j++] = Infinity; //#20280
    $k[$j++] = 1; //#20280
    for (var _NR = 0, _NS = $_.ecpb; _NR < _NS; _NR++) { //#20280
        $k[$j++] = 0; //#20280
    } //#20280
    $_.coeffs = $a(); //#20280
    for (var _NW = 0, _NV = $_.ecpb - 1; _NW <= _NV; _NW += 1) { //#20289
        $_.i = _NW; //#20282
        $put($_.coeffs, $_.i + 1, $get($_.coeffs, $_.i)); //#20283
        for (var _Nd = $_.i; _Nd >= 1; _Nd -= 1) { //#20287
            $_.j = _Nd; //#20285
            $k[$j++] = $_.coeffs; //#20286
            $k[$j++] = $_.j; //#20286
            $k[$j++] = $get($_.coeffs, $_.j - 1); //#20286
            $k[$j++] = $get($_.coeffs, $_.j); //#20286
            $k[$j++] = $get($_.rsalog, $_.i); //#20286
            $_.rsprod(); //#20286
            var _Np = $k[--$j]; //#20286
            var _Nq = $k[--$j]; //#20286
            var _Nr = $k[--$j]; //#20286
            $put($k[--$j], _Nr, $xo(_Nq, _Np)); //#20286
        } //#20286
        $k[$j++] = $_.coeffs; //#20288
        $k[$j++] = 0; //#20288
        $k[$j++] = $get($_.coeffs, 0); //#20288
        $k[$j++] = $get($_.rsalog, $_.i); //#20288
        $_.rsprod(); //#20288
        var _Nz = $k[--$j]; //#20288
        var _O0 = $k[--$j]; //#20288
        $put($k[--$j], _O0, _Nz); //#20288
    } //#20288
    $_.coeffs = $geti($_.coeffs, 0, $_.coeffs.length - 1); //#20290
    $_.rscodes = function() {
        $_.rscws = $k[--$j]; //#20294
        $_.rsnd = $_.rscws.length; //#20295
        $k[$j++] = Infinity; //#20296
        $forall($_.rscws); //#20296
        for (var _O9 = 0, _OA = $_.ecpb; _O9 < _OA; _O9++) { //#20296
            $k[$j++] = 0; //#20296
        } //#20296
        $_.rscws = $a(); //#20296
        for (var _OE = 0, _OD = $_.rsnd - 1; _OE <= _OD; _OE += 1) { //#20304
            $_.m = _OE; //#20298
            $_.k = $get($_.rscws, $_.m); //#20299
            for (var _OK = 0, _OJ = $_.ecpb - 1; _OK <= _OJ; _OK += 1) { //#20303
                $_.j = _OK; //#20301
                $k[$j++] = $_.rscws; //#20302
                $k[$j++] = ($_.m + $_.j) + 1; //#20302
                $k[$j++] = $get($_.coeffs, ($_.ecpb - $_.j) - 1); //#20302
                $k[$j++] = $_.k; //#20302
                $_.rsprod(); //#20302
                var _OX = $k[--$j]; //#20302
                var _OY = $k[--$j]; //#20302
                $put($k[--$j], _OY, $xo(_OX, $get($_.rscws, ($_.m + $_.j) + 1))); //#20302
            } //#20302
        } //#20302
        $k[$j++] = $geti($_.rscws, $_.rsnd, $_.ecpb); //#20305
    }; //#20305
    $_.dcwsb = $a($f($_.ecb1 + $_.ecb2)); //#20309
    $_.ecwsb = $a($f($_.ecb1 + $_.ecb2)); //#20310
    for (var _Om = 0, _Ol = $f($_.ecb1 - 1); _Om <= _Ol; _Om += 1) { //#20315
        $_.i = _Om; //#20312
        $put($_.dcwsb, $_.i, $geti($_.cws, $_.i * $_.dcpb, $_.dcpb)); //#20313
        $k[$j++] = $_.ecwsb; //#20314
        $k[$j++] = $_.i; //#20314
        $k[$j++] = $get($_.dcwsb, $_.i); //#20314
        $_.rscodes(); //#20314
        var _Oz = $k[--$j]; //#20314
        var _P0 = $k[--$j]; //#20314
        $put($k[--$j], _P0, _Oz); //#20314
    } //#20314
    for (var _P4 = 0, _P3 = $f($_.ecb2 - 1); _P4 <= _P3; _P4 += 1) { //#20320
        $_.i = _P4; //#20317
        $put($_.dcwsb, $f($_.ecb1 + $_.i), $geti($_.cws, $f(($_.ecb1 * $_.dcpb) + ($_.i * ($_.dcpb + 1))), $_.dcpb + 1)); //#20318
        $k[$j++] = $_.ecwsb; //#20319
        $k[$j++] = $f($_.ecb1 + $_.i); //#20319
        $k[$j++] = $get($_.dcwsb, $f($_.ecb1 + $_.i)); //#20319
        $_.rscodes(); //#20319
        var _PM = $k[--$j]; //#20319
        var _PN = $k[--$j]; //#20319
        $put($k[--$j], _PN, _PM); //#20319
    } //#20319
    $_.cws = $a($_.ncws); //#20323
    $_.cw = 0; //#20324
    for (var _PT = 0, _PS = $_.dcpb; _PT <= _PS; _PT += 1) { //#20334
        $_.i = _PT; //#20326
        for (var _PX = 0, _PW = $f($f($_.ecb1 + $_.ecb2) - 1); _PX <= _PW; _PX += 1) { //#20333
            $_.j = _PX; //#20328
            if ($_.i < $get($_.dcwsb, $_.j).length) { //#20332
                $put($_.cws, $_.cw, $get($get($_.dcwsb, $_.j), $_.i)); //#20330
                $_.cw = $_.cw + 1; //#20331
            } //#20331
        } //#20331
    } //#20331
    for (var _Pm = 0, _Pl = $_.ecpb - 1; _Pm <= _Pl; _Pm += 1) { //#20342
        $_.i = _Pm; //#20336
        for (var _Pq = 0, _Pp = $f($f($_.ecb1 + $_.ecb2) - 1); _Pq <= _Pp; _Pq += 1) { //#20341
            $_.j = _Pq; //#20338
            $put($_.cws, $_.cw, $get($get($_.ecwsb, $_.j), $_.i)); //#20339
            $_.cw = $_.cw + 1; //#20340
        } //#20340
    } //#20340
    if ($_.rbit > 0) { //#20350
        $_.pad = $a($_.cws.length + 1); //#20346
        $puti($_.pad, 0, $_.cws); //#20347
        $put($_.pad, $_.pad.length - 1, 0); //#20348
        $_.cws = $_.pad; //#20349
    } //#20349
    if ($_.lc4b) { //#20361
        var _Q8 = $_.cws; //#20354
        var _Q9 = $_.dcws; //#20354
        $put(_Q8, $f(_Q9 - 1), $get(_Q8, $f(_Q9 - 1)) >>> 4); //#20354
        for (var _QE = $f($_.dcws - 1), _QD = $_.ncws - 2; _QE <= _QD; _QE += 1) { //#20359
            $_.i = _QE; //#20356
            $put($_.cws, $_.i, ($get($_.cws, $_.i) & 15) << 4); //#20357
            $put($_.cws, $_.i, (($get($_.cws, $_.i + 1) >>> 4) & 15) | $get($_.cws, $_.i)); //#20358
        } //#20358
        $put($_.cws, $_.ncws - 1, ($get($_.cws, $_.ncws - 1) & 15) << 4); //#20360
    } //#20360
    var _QY = $get($_.options, 'debugecc') !== undefined; //#20363
    if (_QY) { //#20363
        $k[$j++] = 'bwipp.debugecc#20363'; //#20363
        $k[$j++] = $_.cws; //#20363
        bwipp_raiseerror(); //#20363
    } //#20363
    $k[$j++] = Infinity; //#20366
    for (var _Qc = 0, _Qd = $_.rows * $_.cols; _Qc < _Qd; _Qc++) { //#20366
        $k[$j++] = -1; //#20366
    } //#20366
    $_.pixs = $a(); //#20366
    $_.qmv = function() {
        var _Qg = $k[--$j]; //#20367
        var _Qh = $k[--$j]; //#20367
        $k[$j++] = $f(_Qh + (_Qg * $_.cols)); //#20367
    }; //#20367
    if ($eq($_.format, "full")) { //#20376
        for (var _Ql = 8, _Qk = $f($_.cols - 9); _Ql <= _Qk; _Ql += 1) { //#20375
            $_.i = _Ql; //#20372
            $k[$j++] = $_.pixs; //#20373
            $k[$j++] = $_.i; //#20373
            $k[$j++] = 6; //#20373
            $_.qmv(); //#20373
            var _Qp = $k[--$j]; //#20373
            $put($k[--$j], _Qp, ($_.i + 1) % 2); //#20373
            $k[$j++] = $_.pixs; //#20374
            $k[$j++] = 6; //#20374
            $k[$j++] = $_.i; //#20374
            $_.qmv(); //#20374
            var _Qu = $k[--$j]; //#20374
            $put($k[--$j], _Qu, ($_.i + 1) % 2); //#20374
        } //#20374
    } //#20374
    if ($eq($_.format, "micro")) { //#20383
        for (var _Qz = 8, _Qy = $f($_.cols - 1); _Qz <= _Qy; _Qz += 1) { //#20382
            $_.i = _Qz; //#20379
            $k[$j++] = $_.pixs; //#20380
            $k[$j++] = $_.i; //#20380
            $k[$j++] = 0; //#20380
            $_.qmv(); //#20380
            var _R3 = $k[--$j]; //#20380
            $put($k[--$j], _R3, ($_.i + 1) % 2); //#20380
            $k[$j++] = $_.pixs; //#20381
            $k[$j++] = 0; //#20381
            $k[$j++] = $_.i; //#20381
            $_.qmv(); //#20381
            var _R8 = $k[--$j]; //#20381
            $put($k[--$j], _R8, ($_.i + 1) % 2); //#20381
        } //#20381
    } //#20381
    if ($eq($_.format, "rmqr")) { //#20402
        for (var _RD = 3, _RC = $f($_.cols - 4); _RD <= _RC; _RD += 1) { //#20389
            $_.i = _RD; //#20386
            $k[$j++] = $_.pixs; //#20387
            $k[$j++] = $_.i; //#20387
            $k[$j++] = 0; //#20387
            $_.qmv(); //#20387
            var _RH = $k[--$j]; //#20387
            $put($k[--$j], _RH, ($_.i + 1) % 2); //#20387
            $k[$j++] = $_.pixs; //#20388
            $k[$j++] = $_.i; //#20388
            $k[$j++] = $f($_.rows - 1); //#20388
            $_.qmv(); //#20388
            var _RN = $k[--$j]; //#20388
            $put($k[--$j], _RN, ($_.i + 1) % 2); //#20388
        } //#20388
        for (var _RR = 3, _RQ = $f($_.rows - 4); _RR <= _RQ; _RR += 1) { //#20394
            $_.i = _RR; //#20391
            $k[$j++] = $_.pixs; //#20392
            $k[$j++] = 0; //#20392
            $k[$j++] = $_.i; //#20392
            $_.qmv(); //#20392
            var _RV = $k[--$j]; //#20392
            $put($k[--$j], _RV, ($_.i + 1) % 2); //#20392
            $k[$j++] = $_.pixs; //#20393
            $k[$j++] = $f($_.cols - 1); //#20393
            $k[$j++] = $_.i; //#20393
            $_.qmv(); //#20393
            var _Rb = $k[--$j]; //#20393
            $put($k[--$j], _Rb, ($_.i + 1) % 2); //#20393
        } //#20393
        for (var _Ri = $f($_.asp2 - 1), _Rj = $f($_.asp3 - $_.asp2), _Rh = $f($_.cols - 13); _Rj < 0 ? _Ri >= _Rh : _Ri <= _Rh; _Ri += _Rj) { //#20401
            $_.i = _Ri; //#20396
            for (var _Rm = 3, _Rl = $f($_.rows - 4); _Rm <= _Rl; _Rm += 1) { //#20400
                $_.j = _Rm; //#20398
                $k[$j++] = $_.pixs; //#20399
                $k[$j++] = $_.i; //#20399
                $k[$j++] = $_.j; //#20399
                $_.qmv(); //#20399
                var _Rr = $k[--$j]; //#20399
                $put($k[--$j], _Rr, ($_.j + 1) % 2); //#20399
            } //#20399
        } //#20399
    } //#20399
    if (!bwipp_qrcode.__20452__) { //#20452
        $_ = Object.create($_); //#20452
        $_.fpat = $a([$a([1, 1, 1, 1, 1, 1, 1, 0]), $a([1, 0, 0, 0, 0, 0, 1, 0]), $a([1, 0, 1, 1, 1, 0, 1, 0]), $a([1, 0, 1, 1, 1, 0, 1, 0]), $a([1, 0, 1, 1, 1, 0, 1, 0]), $a([1, 0, 0, 0, 0, 0, 1, 0]), $a([1, 1, 1, 1, 1, 1, 1, 0]), $a([0, 0, 0, 0, 0, 0, 0, 0])]); //#20415
        $_.fsubpat = $a([$a([1, 1, 1, 1, 1, 9, 9, 9]), $a([1, 0, 0, 0, 1, 9, 9, 9]), $a([1, 0, 1, 0, 1, 9, 9, 9]), $a([1, 0, 0, 0, 1, 9, 9, 9]), $a([1, 1, 1, 1, 1, 9, 9, 9]), $a([9, 9, 9, 9, 9, 9, 9, 9]), $a([9, 9, 9, 9, 9, 9, 9, 9]), $a([9, 9, 9, 9, 9, 9, 9, 9])]); //#20425
        $_.fcorpat = $a([$a([1, 1, 1, 9, 9, 9, 9, 9]), $a([1, 0, 9, 9, 9, 9, 9, 9]), $a([1, 9, 9, 9, 9, 9, 9, 9]), $a([9, 9, 9, 9, 9, 9, 9, 9]), $a([9, 9, 9, 9, 9, 9, 9, 9]), $a([9, 9, 9, 9, 9, 9, 9, 9]), $a([9, 9, 9, 9, 9, 9, 9, 9]), $a([9, 9, 9, 9, 9, 9, 9, 9])]); //#20435
        $_.fnullpat = $a([$a([9, 9, 9, 9, 9, 9, 9, 9]), $a([9, 9, 9, 9, 9, 9, 9, 9]), $a([9, 9, 9, 9, 9, 9, 9, 9]), $a([9, 9, 9, 9, 9, 9, 9, 9]), $a([9, 9, 9, 9, 9, 9, 9, 9]), $a([9, 9, 9, 9, 9, 9, 9, 9]), $a([9, 9, 9, 9, 9, 9, 9, 9]), $a([9, 9, 9, 9, 9, 9, 9, 9])]); //#20445
        var _Si = new Map([
            ["full", $a([$_.fpat, $_.fpat, $_.fpat, $_.fnullpat])],
            ["micro", $a([$_.fpat, $_.fnullpat, $_.fnullpat, $_.fnullpat])],
            ["rmqr", $a([$_.fpat, $_.fcorpat, $_.fcorpat, $_.fsubpat])]
        ]); //#20450
        $_.fpatmap = _Si; //#20451
        for (var id in $_) $_.hasOwnProperty(id) && (bwipp_qrcode.$ctx[id] = $_[id]); //#20451
        bwipp_qrcode.__20452__ = 1; //#20451
        $_ = Object.getPrototypeOf($_); //#20451
    } //#20451
    $_.fpats = $get($_.fpatmap, $_.format); //#20453
    for (var _Sn = 0; _Sn <= 7; _Sn += 1) { //#20467
        $_.y = _Sn; //#20455
        for (var _So = 0; _So <= 7; _So += 1) { //#20466
            $_.x = _So; //#20457
            $_.fpb0 = $get($get($get($_.fpats, 0), $_.y), $_.x); //#20458
            $_.fpb1 = $get($get($get($_.fpats, 1), $_.y), $_.x); //#20459
            $_.fpb2 = $get($get($get($_.fpats, 2), $_.y), $_.x); //#20460
            $_.fpb3 = $get($get($get($_.fpats, 3), $_.y), $_.x); //#20461
            if (($_.fpb0 != 9) && ($_.y < $_.rows)) { //#20462
                $k[$j++] = $_.pixs; //#20462
                $k[$j++] = $_.x; //#20462
                $k[$j++] = $_.y; //#20462
                $_.qmv(); //#20462
                var _TK = $k[--$j]; //#20462
                $put($k[--$j], _TK, $_.fpb0); //#20462
            } //#20462
            if ($_.fpb1 != 9) { //#20463
                $k[$j++] = $_.pixs; //#20463
                $k[$j++] = $f($f($_.cols - $_.x) - 1); //#20463
                $k[$j++] = $_.y; //#20463
                $_.qmv(); //#20463
                var _TS = $k[--$j]; //#20463
                $put($k[--$j], _TS, $_.fpb1); //#20463
            } //#20463
            if ($_.fpb2 != 9) { //#20464
                $k[$j++] = $_.pixs; //#20464
                $k[$j++] = $_.x; //#20464
                $k[$j++] = $f($f($_.rows - $_.y) - 1); //#20464
                $_.qmv(); //#20464
                var _Ta = $k[--$j]; //#20464
                $put($k[--$j], _Ta, $_.fpb2); //#20464
            } //#20464
            if ($_.fpb3 != 9) { //#20465
                $k[$j++] = $_.pixs; //#20465
                $k[$j++] = $f($f($_.cols - $_.x) - 1); //#20465
                $k[$j++] = $f($f($_.rows - $_.y) - 1); //#20465
                $_.qmv(); //#20465
                var _Tj = $k[--$j]; //#20465
                $put($k[--$j], _Tj, $_.fpb3); //#20465
            } //#20465
        } //#20465
    } //#20465
    if (!bwipp_qrcode.__20485__) { //#20485
        $_ = Object.create($_); //#20485
        $_.algnpatfull = $a([$a([1, 1, 1, 1, 1]), $a([1, 0, 0, 0, 1]), $a([1, 0, 1, 0, 1]), $a([1, 0, 0, 0, 1]), $a([1, 1, 1, 1, 1])]); //#20477
        $_.algnpatrmqr = $a([$a([1, 1, 1, 9, 9]), $a([1, 0, 1, 9, 9]), $a([1, 1, 1, 9, 9]), $a([9, 9, 9, 9, 9]), $a([9, 9, 9, 9, 9])]); //#20484
        for (var id in $_) $_.hasOwnProperty(id) && (bwipp_qrcode.$ctx[id] = $_[id]); //#20484
        bwipp_qrcode.__20485__ = 1; //#20484
        $_ = Object.getPrototypeOf($_); //#20484
    } //#20484
    $_.putalgnpat = function() {
        $_.py = $k[--$j]; //#20488
        $_.px = $k[--$j]; //#20489
        for (var _U0 = 0; _U0 <= 4; _U0 += 1) { //#20499
            $_.pb = _U0; //#20491
            for (var _U1 = 0; _U1 <= 4; _U1 += 1) { //#20498
                $_.pa = _U1; //#20493
                $_.algnb = $get($get($_.algnpat, $_.pb), $_.pa); //#20494
                if ($_.algnb != 9) { //#20497
                    $k[$j++] = $_.pixs; //#20496
                    $k[$j++] = $f($_.px + $_.pa); //#20496
                    $k[$j++] = $f($_.py + $_.pb); //#20496
                    $_.qmv(); //#20496
                    var _UE = $k[--$j]; //#20496
                    $put($k[--$j], _UE, $_.algnb); //#20496
                } //#20496
            } //#20496
        } //#20496
    }; //#20496
    if ($eq($_.format, "full")) { //#20515
        $_.algnpat = $_.algnpatfull; //#20502
        for (var _UN = $f($_.asp2 - 2), _UO = $f($_.asp3 - $_.asp2), _UM = $f($_.cols - 13); _UO < 0 ? _UN >= _UM : _UN <= _UM; _UN += _UO) { //#20507
            $_.i = _UN; //#20504
            $k[$j++] = $_.i; //#20505
            $k[$j++] = 4; //#20505
            $_.putalgnpat(); //#20505
            $k[$j++] = 4; //#20506
            $k[$j++] = $_.i; //#20506
            $_.putalgnpat(); //#20506
        } //#20506
        for (var _UW = $f($_.asp2 - 2), _UX = $f($_.asp3 - $_.asp2), _UV = $f($_.cols - 9); _UX < 0 ? _UW >= _UV : _UW <= _UV; _UW += _UX) { //#20514
            $_.x = _UW; //#20509
            for (var _Ud = $f($_.asp2 - 2), _Ue = $f($_.asp3 - $_.asp2), _Uc = $f($_.rows - 9); _Ue < 0 ? _Ud >= _Uc : _Ud <= _Uc; _Ud += _Ue) { //#20513
                $_.y = _Ud; //#20511
                $k[$j++] = $_.x; //#20512
                $k[$j++] = $_.y; //#20512
                $_.putalgnpat(); //#20512
            } //#20512
        } //#20512
    } //#20512
    if ($eq($_.format, "rmqr")) { //#20523
        $_.algnpat = $_.algnpatrmqr; //#20517
        for (var _Uo = $f($_.asp2 - 2), _Up = $f($_.asp3 - $_.asp2), _Un = $f($_.cols - 13); _Up < 0 ? _Uo >= _Un : _Uo <= _Un; _Uo += _Up) { //#20522
            $_.i = _Uo; //#20519
            $k[$j++] = $_.i; //#20520
            $k[$j++] = 0; //#20520
            $_.putalgnpat(); //#20520
            $k[$j++] = $_.i; //#20521
            $k[$j++] = $f($_.rows - 3); //#20521
            $_.putalgnpat(); //#20521
        } //#20521
    } //#20521
    if (!bwipp_qrcode.__20532__) { //#20532
        $_ = Object.create($_); //#20532
        $_.formatmapmicro = $a([$a([$a([1, 8])]), $a([$a([2, 8])]), $a([$a([3, 8])]), $a([$a([4, 8])]), $a([$a([5, 8])]), $a([$a([6, 8])]), $a([$a([7, 8])]), $a([$a([8, 8])]), $a([$a([8, 7])]), $a([$a([8, 6])]), $a([$a([8, 5])]), $a([$a([8, 4])]), $a([$a([8, 3])]), $a([$a([8, 2])]), $a([$a([8, 1])])]); //#20531
        for (var id in $_) $_.hasOwnProperty(id) && (bwipp_qrcode.$ctx[id] = $_[id]); //#20531
        bwipp_qrcode.__20532__ = 1; //#20531
        $_ = Object.getPrototypeOf($_); //#20531
    } //#20531
    var _Xs = new Map([
        ["full", $a([$a([$a([0, 8]), $a([8, $f($_.cols - 1)])]), $a([$a([1, 8]), $a([8, $f($_.cols - 2)])]), $a([$a([2, 8]), $a([8, $f($_.cols - 3)])]), $a([$a([3, 8]), $a([8, $f($_.cols - 4)])]), $a([$a([4, 8]), $a([8, $f($_.cols - 5)])]), $a([$a([5, 8]), $a([8, $f($_.cols - 6)])]), $a([$a([7, 8]), $a([8, $f($_.cols - 7)])]), $a([$a([8, 8]), $a([$f($_.cols - 8), 8])]), $a([$a([8, 7]), $a([$f($_.cols - 7), 8])]), $a([$a([8, 5]), $a([$f($_.cols - 6), 8])]), $a([$a([8, 4]), $a([$f($_.cols - 5), 8])]), $a([$a([8, 3]), $a([$f($_.cols - 4), 8])]), $a([$a([8, 2]), $a([$f($_.cols - 3), 8])]), $a([$a([8, 1]), $a([$f($_.cols - 2), 8])]), $a([$a([8, 0]), $a([$f($_.cols - 1), 8])])])],
        ["micro", $_.formatmapmicro],
        ["rmqr", $a([$a([$a([11, 3]), $a([$f($_.cols - 3), $f($_.rows - 6)])]), $a([$a([11, 2]), $a([$f($_.cols - 4), $f($_.rows - 6)])]), $a([$a([11, 1]), $a([$f($_.cols - 5), $f($_.rows - 6)])]), $a([$a([10, 5]), $a([$f($_.cols - 6), $f($_.rows - 2)])]), $a([$a([10, 4]), $a([$f($_.cols - 6), $f($_.rows - 3)])]), $a([$a([10, 3]), $a([$f($_.cols - 6), $f($_.rows - 4)])]), $a([$a([10, 2]), $a([$f($_.cols - 6), $f($_.rows - 5)])]), $a([$a([10, 1]), $a([$f($_.cols - 6), $f($_.rows - 6)])]), $a([$a([9, 5]), $a([$f($_.cols - 7), $f($_.rows - 2)])]), $a([$a([9, 4]), $a([$f($_.cols - 7), $f($_.rows - 3)])]), $a([$a([9, 3]), $a([$f($_.cols - 7), $f($_.rows - 4)])]), $a([$a([9, 2]), $a([$f($_.cols - 7), $f($_.rows - 5)])]), $a([$a([9, 1]), $a([$f($_.cols - 7), $f($_.rows - 6)])]), $a([$a([8, 5]), $a([$f($_.cols - 8), $f($_.rows - 2)])]), $a([$a([8, 4]), $a([$f($_.cols - 8), $f($_.rows - 3)])]), $a([$a([8, 3]), $a([$f($_.cols - 8), $f($_.rows - 4)])]), $a([$a([8, 2]), $a([$f($_.cols - 8), $f($_.rows - 5)])]), $a([$a([8, 1]), $a([$f($_.cols - 8), $f($_.rows - 6)])])])]
    ]); //#20548
    $_.formatmap = $get(_Xs, $_.format); //#20550
    $forall($_.formatmap, function() { //#20553
        $forall($k[--$j], function() { //#20552
            $forall($k[--$j]); //#20552
            $_.qmv(); //#20552
            $put($_.pixs, $k[--$j], 1); //#20552
        }); //#20552
    }); //#20552
    if ($eq($_.format, "full") && ($_.cols >= 45)) { //#20569
        $_.versionmap = $a([$a([$a([$f($_.cols - 9), 5]), $a([5, $f($_.cols - 9)])]), $a([$a([$f($_.cols - 10), 5]), $a([5, $f($_.cols - 10)])]), $a([$a([$f($_.cols - 11), 5]), $a([5, $f($_.cols - 11)])]), $a([$a([$f($_.cols - 9), 4]), $a([4, $f($_.cols - 9)])]), $a([$a([$f($_.cols - 10), 4]), $a([4, $f($_.cols - 10)])]), $a([$a([$f($_.cols - 11), 4]), $a([4, $f($_.cols - 11)])]), $a([$a([$f($_.cols - 9), 3]), $a([3, $f($_.cols - 9)])]), $a([$a([$f($_.cols - 10), 3]), $a([3, $f($_.cols - 10)])]), $a([$a([$f($_.cols - 11), 3]), $a([3, $f($_.cols - 11)])]), $a([$a([$f($_.cols - 9), 2]), $a([2, $f($_.cols - 9)])]), $a([$a([$f($_.cols - 10), 2]), $a([2, $f($_.cols - 10)])]), $a([$a([$f($_.cols - 11), 2]), $a([2, $f($_.cols - 11)])]), $a([$a([$f($_.cols - 9), 1]), $a([1, $f($_.cols - 9)])]), $a([$a([$f($_.cols - 10), 1]), $a([1, $f($_.cols - 10)])]), $a([$a([$f($_.cols - 11), 1]), $a([1, $f($_.cols - 11)])]), $a([$a([$f($_.cols - 9), 0]), $a([0, $f($_.cols - 9)])]), $a([$a([$f($_.cols - 10), 0]), $a([0, $f($_.cols - 10)])]), $a([$a([$f($_.cols - 11), 0]), $a([0, $f($_.cols - 11)])])]); //#20567
    } else { //#20569
        $_.versionmap = $a([]); //#20569
    } //#20569
    var _ZW = $_.versionmap; //#20571
    for (var _ZX = 0, _ZY = _ZW.length; _ZX < _ZY; _ZX++) { //#20573
        $forall($get(_ZW, _ZX), function() { //#20572
            $forall($k[--$j]); //#20572
            $_.qmv(); //#20572
            $put($_.pixs, $k[--$j], 0); //#20572
        }); //#20572
    } //#20572
    if ($eq($_.format, "full")) { //#20578
        $k[$j++] = $_.pixs; //#20577
        $k[$j++] = 8; //#20577
        $k[$j++] = $f($_.rows - 8); //#20577
        $_.qmv(); //#20577
        var _Zg = $k[--$j]; //#20577
        $put($k[--$j], _Zg, 0); //#20577
    } //#20577
    var _a0 = $a([function() {
        var _Zi = $k[--$j]; //#20583
        var _Zj = $k[--$j]; //#20583
        $k[$j++] = $f(_Zj + _Zi) % 2; //#20583
    }, function() {
        var _Zk = $k[--$j]; //#20584
        var _Zl = $k[--$j]; //#20584
        $k[$j++] = _Zk; //#20584
        $k[$j++] = _Zl; //#20584
        $j--; //#20584
        var _Zm = $k[--$j]; //#20584
        $k[$j++] = _Zm % 2; //#20584
    }, function() {
        $j--; //#20585
        var _Zn = $k[--$j]; //#20585
        $k[$j++] = _Zn % 3; //#20585
    }, function() {
        var _Zo = $k[--$j]; //#20586
        var _Zp = $k[--$j]; //#20586
        $k[$j++] = $f(_Zp + _Zo) % 3; //#20586
    }, function() {
        var _Zq = $k[--$j]; //#20587
        var _Zr = $k[--$j]; //#20587
        $k[$j++] = ((~~(_Zq / 2)) + (~~(_Zr / 3))) % 2; //#20587
    }, function() {
        var _Zs = $k[--$j]; //#20588
        var _Zu = $k[--$j] * _Zs; //#20588
        $k[$j++] = $f((_Zu % 2) + (_Zu % 3)); //#20588
    }, function() {
        var _Zv = $k[--$j]; //#20589
        var _Zx = $k[--$j] * _Zv; //#20589
        $k[$j++] = ($f((_Zx % 2) + (_Zx % 3))) % 2; //#20589
    }, function() {
        var _Zy = $k[--$j]; //#20590
        var _Zz = $k[--$j]; //#20590
        $k[$j++] = ($f(((_Zz * _Zy) % 3) + ($f(_Zz + _Zy) % 2))) % 2; //#20590
    }]); //#20590
    var _aB = $a([function() {
        var _a1 = $k[--$j]; //#20593
        var _a2 = $k[--$j]; //#20593
        $k[$j++] = _a1; //#20593
        $k[$j++] = _a2; //#20593
        $j--; //#20593
        var _a3 = $k[--$j]; //#20593
        $k[$j++] = _a3 % 2; //#20593
    }, function() {
        var _a4 = $k[--$j]; //#20594
        var _a5 = $k[--$j]; //#20594
        $k[$j++] = ((~~(_a4 / 2)) + (~~(_a5 / 3))) % 2; //#20594
    }, function() {
        var _a6 = $k[--$j]; //#20595
        var _a8 = $k[--$j] * _a6; //#20595
        $k[$j++] = ($f((_a8 % 2) + (_a8 % 3))) % 2; //#20595
    }, function() {
        var _a9 = $k[--$j]; //#20596
        var _aA = $k[--$j]; //#20596
        $k[$j++] = ($f(((_aA * _a9) % 3) + ($f(_aA + _a9) % 2))) % 2; //#20596
    }]); //#20596
    var _aE = $a([function() {
        var _aC = $k[--$j]; //#20599
        var _aD = $k[--$j]; //#20599
        $k[$j++] = ((~~(_aC / 2)) + (~~(_aD / 3))) % 2; //#20599
    }]); //#20599
    var _aF = new Map([
        ["full", _a0],
        ["micro", _aB],
        ["rmqr", _aE]
    ]); //#20599
    $_.maskfuncs = $get(_aF, $_.format); //#20601
    if ($_.mask != -1) { //#20605
        $_.maskfuncs = $a([$get($_.maskfuncs, $_.mask - 1)]); //#20603
        $_.bestmaskval = $_.mask - 1; //#20604
    } //#20604
    $_.masks = $a($_.maskfuncs.length); //#20606
    for (var _aS = 0, _aR = $_.masks.length - 1; _aS <= _aR; _aS += 1) { //#20620
        $_.m = _aS; //#20608
        $_.mask = $a($_.rows * $_.cols); //#20609
        for (var _aY = 0, _aX = $f($_.rows - 1); _aY <= _aX; _aY += 1) { //#20618
            $_.j = _aY; //#20611
            for (var _ab = 0, _aa = $f($_.cols - 1); _ab <= _aa; _ab += 1) { //#20617
                $_.i = _ab; //#20613
                $k[$j++] = $_.i; //#20614
                $k[$j++] = $_.j; //#20614
                if ($get($_.maskfuncs, $_.m)() === true) {
                    break;
                } //#20614
                var _ah = $k[--$j]; //#20614
                $k[$j++] = _ah == 0; //#20615
                $k[$j++] = $_.pixs; //#20615
                $k[$j++] = $_.i; //#20615
                $k[$j++] = $_.j; //#20615
                $_.qmv(); //#20615
                var _al = $k[--$j]; //#20615
                var _an = $get($k[--$j], _al); //#20615
                var _ao = $k[--$j]; //#20615
                var _ap = (_ao && (_an == -1)) ? 1 : 0; //#20615
                $k[$j++] = _ap; //#20616
                $k[$j++] = $_.mask; //#20616
                $k[$j++] = $_.i; //#20616
                $k[$j++] = $_.j; //#20616
                $_.qmv(); //#20616
                var _at = $k[--$j]; //#20616
                var _au = $k[--$j]; //#20616
                $put(_au, _at, $k[--$j]); //#20616
            } //#20616
        } //#20616
        $put($_.masks, $_.m, $_.mask); //#20619
    } //#20619
    var _b1 = $ne($_.format, "rmqr") ? 1 : 2; //#20623
    $_.posx = $f($_.cols - _b1); //#20623
    $_.posy = $f($_.rows - 1); //#20624
    $_.dir = -1; //#20625
    $_.col = 1; //#20626
    $_.num = 0; //#20627
    for (;;) { //#20650
        if ($_.posx < 0) { //#20629
            break; //#20629
        } //#20629
        $k[$j++] = $_.pixs; //#20630
        $k[$j++] = $_.posx; //#20630
        $k[$j++] = $_.posy; //#20630
        $_.qmv(); //#20630
        var _b7 = $k[--$j]; //#20630
        if ($get($k[--$j], _b7) == -1) { //#20634
            var _bC = $get($_.cws, ~~($_.num / 8)); //#20631
            var _bE = -(7 - ($_.num % 8)); //#20631
            $k[$j++] = ((_bE < 0 ? _bC >>> -_bE : _bC << _bE)) & 1; //#20632
            $k[$j++] = $_.pixs; //#20632
            $k[$j++] = $_.posx; //#20632
            $k[$j++] = $_.posy; //#20632
            $_.qmv(); //#20632
            var _bI = $k[--$j]; //#20632
            var _bJ = $k[--$j]; //#20632
            $put(_bJ, _bI, $k[--$j]); //#20632
            $_.num = $_.num + 1; //#20633
        } //#20633
        if ($_.col == 1) { //#20647
            $_.col = 0; //#20636
            $_.posx = $f($_.posx - 1); //#20637
        } else { //#20647
            $_.col = 1; //#20639
            $_.posx = $f($_.posx + 1); //#20640
            $_.posy = $f($_.posy + $_.dir); //#20641
            if (($_.posy < 0) || ($_.posy >= $_.rows)) { //#20648
                $_.dir = $_.dir * -1; //#20643
                $_.posy = $f($_.posy + $_.dir); //#20644
                $_.posx = $f($_.posx - 2); //#20645
                if ($eq($_.format, "full") && ($_.posx == 6)) { //#20647
                    $_.posx = $f($_.posx - 1); //#20647
                } //#20647
            } //#20647
        } //#20647
    } //#20647
    $_.evalfulln1n3 = function() {
        $_.scrle = $k[--$j]; //#20654
        $k[$j++] = 'scr1'; //#20656
        $k[$j++] = 0; //#20656
        $forall($_.scrle, function() { //#20656
            var _bd = $k[--$j]; //#20656
            $k[$j++] = _bd; //#20656
            if (_bd >= 5) { //#20656
                var _be = $k[--$j]; //#20656
                var _bg = $f($f($k[--$j] + _be) - 2); //#20656
                $k[$j++] = _bg; //#20656
                $k[$j++] = _bg; //#20656
            } //#20656
            $j--; //#20656
        }); //#20656
        var _bh = $k[--$j]; //#20656
        $_[$k[--$j]] = _bh; //#20656
        $_.scr3 = 0; //#20658
        for (var _bl = 3, _bk = $_.scrle.length - 3; _bl <= _bk; _bl += 2) { //#20673
            $_.j = _bl; //#20660
            if (($get($_.scrle, $_.j) % 3) == 0) { //#20672
                $_.fact = ~~($get($_.scrle, $_.j) / 3); //#20662
                var _bu = $geti($_.scrle, $_.j - 2, 5); //#20663
                for (var _bv = 0, _bw = _bu.length; _bv < _bw; _bv++) { //#20663
                    $k[$j++] = $get(_bu, _bv) == $_.fact; //#20663
                } //#20663
                var _bz = $k[--$j]; //#20663
                var _c0 = $k[--$j]; //#20663
                var _c1 = $k[--$j]; //#20663
                $k[$j++] = $an(_c0, _bz); //#20663
                $k[$j++] = _c1; //#20663
                $j--; //#20663
                var _c2 = $k[--$j]; //#20663
                var _c3 = $k[--$j]; //#20663
                var _c4 = $k[--$j]; //#20663
                if (_c4 && (_c3 && _c2)) { //#20671
                    if (($_.j == 3) || (($_.j + 4) >= $_.scrle.length)) { //#20668
                        $_.scr3 = $_.scr3 + 40; //#20665
                    } else { //#20668
                        if (($get($_.scrle, $_.j - 3) >= 4) || ($get($_.scrle, $_.j + 3) >= 4)) { //#20669
                            $_.scr3 = $_.scr3 + 40; //#20668
                        } //#20668
                    } //#20668
                } //#20668
            } //#20668
        } //#20668
        $k[$j++] = $_.scr1; //#20674
        $k[$j++] = $_.scr3; //#20674
    }; //#20674
    $_.evalfull = function() {
        $_.sym = $k[--$j]; //#20679
        $_.n1 = 0; //#20681
        $_.n2 = 0; //#20681
        $_.n3 = 0; //#20681
        $_.rle = $a($f($_.cols + 1)); //#20682
        $_.lastpairs = $a($_.cols); //#20683
        $_.thispairs = $a($_.cols); //#20684
        $_.colsadd1 = $f($_.cols + 1); //#20685
        for (var _cS = 0, _cR = $f($_.cols - 1); _cS <= _cR; _cS += 1) { //#20724
            $_.i = _cS; //#20687
            $k[$j++] = Infinity; //#20690
            var _cU = $_.cols; //#20691
            $k[$j++] = 0; //#20693
            $k[$j++] = 0; //#20693
            for (var _cW = $_.i, _cX = _cU, _cV = $f((_cU * _cU) - 1); _cX < 0 ? _cW >= _cV : _cW <= _cV; _cW += _cX) { //#20693
                var _cZ = $get($_.sym, _cW); //#20692
                var _ca = $k[--$j]; //#20692
                $k[$j++] = _cZ; //#20692
                if ($eq(_ca, _cZ)) { //#20692
                    var _cb = $k[--$j]; //#20692
                    var _cc = $k[--$j]; //#20692
                    $k[$j++] = $f(_cc + 1); //#20692
                    $k[$j++] = _cb; //#20692
                } else { //#20692
                    var _cd = $k[--$j]; //#20692
                    $k[$j++] = 1; //#20692
                    $k[$j++] = _cd; //#20692
                } //#20692
            } //#20692
            $j--; //#20694
            var _cf = $counttomark() + 2; //#20695
            $astore($geti($_.rle, 0, _cf - 2)); //#20695
            $_.evalfulln1n3(); //#20696
            $_.n3 = $f($k[--$j] + $_.n3); //#20696
            $_.n1 = $f($k[--$j] + $_.n1); //#20696
            $j--; //#20697
            $_.symrow = $geti($_.sym, $_.i * $_.cols, $_.cols); //#20700
            $k[$j++] = Infinity; //#20701
            var _cq = $_.symrow; //#20702
            $k[$j++] = 0; //#20704
            $k[$j++] = 0; //#20704
            for (var _cr = 0, _cs = _cq.length; _cr < _cs; _cr++) { //#20704
                var _ct = $get(_cq, _cr); //#20704
                var _cu = $k[--$j]; //#20703
                $k[$j++] = _ct; //#20703
                if ($eq(_cu, _ct)) { //#20703
                    var _cv = $k[--$j]; //#20703
                    var _cw = $k[--$j]; //#20703
                    $k[$j++] = $f(_cw + 1); //#20703
                    $k[$j++] = _cv; //#20703
                } else { //#20703
                    var _cx = $k[--$j]; //#20703
                    $k[$j++] = 1; //#20703
                    $k[$j++] = _cx; //#20703
                } //#20703
            } //#20703
            $j--; //#20705
            var _cz = $counttomark() + 2; //#20706
            $astore($geti($_.rle, 0, _cz - 2)); //#20706
            $_.evalfulln1n3(); //#20707
            $_.n3 = $f($k[--$j] + $_.n3); //#20707
            $_.n1 = $f($k[--$j] + $_.n1); //#20707
            $j--; //#20708
            var _d5 = $_.thispairs; //#20711
            $_.thispairs = $_.lastpairs; //#20711
            $_.lastpairs = _d5; //#20711
            var _d9 = ($get($_.symrow, 0) == 1) ? 0 : 1; //#20712
            var _dA = $_.symrow; //#20713
            $k[$j++] = _d9; //#20713
            for (var _dB = 0, _dC = _dA.length; _dB < _dC; _dB++) { //#20713
                var _dD = $get(_dA, _dB); //#20713
                var _dE = $k[--$j]; //#20713
                $k[$j++] = $f(_dE + _dD); //#20713
                $k[$j++] = _dD; //#20713
            } //#20713
            $j--; //#20714
            $astore($_.thispairs); //#20715
            $j--; //#20715
            if ($_.i > 0) { //#20722
                $k[$j++] = Infinity; //#20717
                $aload($_.lastpairs); //#20718
                $aload($_.thispairs); //#20718
                $k[$j++] = $_.n2; //#20719
                for (var _dL = 0, _dM = $_.cols; _dL < _dM; _dL++) { //#20719
                    var _dN = $k[--$j]; //#20719
                    var _dO = $k[--$j]; //#20719
                    $k[$j++] = _dN; //#20719
                    $k[$j++] = _dO; //#20719
                    var _dQ = $k[$j - 1 - $_.colsadd1]; //#20719
                    if (($f($k[--$j] + _dQ) & 3) == 0) { //#20719
                        var _dS = $k[--$j]; //#20719
                        $k[$j++] = $f(_dS + 3); //#20719
                    } //#20719
                } //#20719
                $_.n2 = $k[--$j]; //#20720
                $cleartomark(); //#20721
            } //#20721
        } //#20721
        $k[$j++] = 'dark'; //#20727
        $k[$j++] = 0; //#20727
        $forall($_.sym, function() { //#20727
            var _dV = $k[--$j]; //#20727
            var _dW = $k[--$j]; //#20727
            $k[$j++] = $f(_dW + _dV); //#20727
        }); //#20727
        var _dX = $k[--$j]; //#20727
        $_[$k[--$j]] = _dX; //#20727
        var _da = $_.cols; //#20728
        $_.n4 = (~~((Math.abs($f((($_.dark * 100) / (_da * _da)) - 50))) / 5)) * 10; //#20728
        $k[$j++] = $f(($f($f($_.n1 + $_.n2) + $_.n3)) + $_.n4); //#20730
    }; //#20730
    $_.evalmicro = function() {
        $_.sym = $k[--$j]; //#20735
        $_.dkrhs = 0; //#20736
        $_.dkbot = 0; //#20736
        for (var _di = 1, _dh = $f($_.cols - 1); _di <= _dh; _di += 1) { //#20741
            $_.i = _di; //#20738
            $k[$j++] = 'dkrhs'; //#20739
            $k[$j++] = $_.dkrhs; //#20739
            $k[$j++] = $_.sym; //#20739
            $k[$j++] = $f($_.cols - 1); //#20739
            $k[$j++] = $_.i; //#20739
            $_.qmv(); //#20739
            var _dn = $k[--$j]; //#20739
            var _dp = $get($k[--$j], _dn); //#20739
            var _dq = $k[--$j]; //#20739
            $_[$k[--$j]] = $f(_dq + _dp); //#20739
            $k[$j++] = 'dkbot'; //#20740
            $k[$j++] = $_.dkbot; //#20740
            $k[$j++] = $_.sym; //#20740
            $k[$j++] = $_.i; //#20740
            $k[$j++] = $f($_.cols - 1); //#20740
            $_.qmv(); //#20740
            var _dw = $k[--$j]; //#20740
            var _dy = $get($k[--$j], _dw); //#20740
            var _dz = $k[--$j]; //#20740
            $_[$k[--$j]] = $f(_dz + _dy); //#20740
        } //#20740
        if ($_.dkrhs <= $_.dkbot) { //#20745
            $k[$j++] = -(($_.dkrhs * 16) + $_.dkbot); //#20743
        } else { //#20745
            $k[$j++] = -(($_.dkbot * 16) + $_.dkrhs); //#20745
        } //#20745
    }; //#20745
    $_.bestscore = 999999999; //#20750
    for (var _e9 = 0, _e8 = $_.masks.length - 1; _e9 <= _e8; _e9 += 1) { //#20772
        $_.m = _e9; //#20752
        $_.masksym = $a($_.rows * $_.cols); //#20753
        for (var _eG = 0, _eF = $f(($_.rows * $_.cols) - 1); _eG <= _eF; _eG += 1) { //#20757
            $_.i = _eG; //#20755
            $put($_.masksym, $_.i, $xo($get($_.pixs, $_.i), $get($get($_.masks, $_.m), $_.i))); //#20756
        } //#20756
        if ($_.masks.length != 1) { //#20770
            if ($eq($_.format, "full")) { //#20762
                $k[$j++] = $_.masksym; //#20760
                $_.evalfull(); //#20760
                $_.score = $k[--$j]; //#20760
            } else { //#20762
                $k[$j++] = $_.masksym; //#20762
                $_.evalmicro(); //#20762
                $_.score = $k[--$j]; //#20762
            } //#20762
            if ($_.score < $_.bestscore) { //#20768
                $_.bestsym = $_.masksym; //#20765
                $_.bestmaskval = $_.m; //#20766
                $_.bestscore = $_.score; //#20767
            } //#20767
        } else { //#20770
            $_.bestsym = $_.masksym; //#20770
        } //#20770
    } //#20770
    $_.pixs = $_.bestsym; //#20773
    if ($eq($_.format, "full")) { //#20778
        $k[$j++] = $_.pixs; //#20777
        $k[$j++] = 8; //#20777
        $k[$j++] = $f($_.cols - 8); //#20777
        $_.qmv(); //#20777
        var _eh = $k[--$j]; //#20777
        $put($k[--$j], _eh, 1); //#20777
    } //#20777
    if (!bwipp_qrcode.__20814__) { //#20814
        $_ = Object.create($_); //#20814
        $_.fmtvalsfull = $a([21522, 20773, 24188, 23371, 17913, 16590, 20375, 19104, 30660, 29427, 32170, 30877, 26159, 25368, 27713, 26998, 5769, 5054, 7399, 6608, 1890, 597, 3340, 2107, 13663, 12392, 16177, 14854, 9396, 8579, 11994, 11245]); //#20787
        $_.fmtvalsmicro = $a([17477, 16754, 20011, 19228, 21934, 20633, 24512, 23287, 26515, 25252, 28157, 26826, 30328, 29519, 31766, 31009, 1758, 1001, 3248, 2439, 5941, 4610, 7515, 6252, 9480, 8255, 12134, 10833, 13539, 12756, 16013, 15290]); //#20793
        $_.fmtvalsrmqr1 = $a([129714, 124311, 121821, 115960, 112748, 108361, 104707, 99878, 98062, 90155, 89697, 82244, 81360, 74485, 72895, 66458, 61898, 61167, 53413, 53120, 45844, 44081, 37499, 36190, 29814, 27475, 21785, 19004, 13992, 10637, 6087, 2274, 258919, 257090, 250376, 249133, 242105, 241308, 233686, 233459, 227035, 223742, 219060, 215185, 209925, 207648, 202090, 199247, 194591, 190266, 186736, 181845, 178881, 173540, 170926, 165003, 163235, 156294, 154828, 148457, 147325, 139352, 138770, 131383]); //#20803
        $_.fmtvalsrmqr2 = $a([133755, 136542, 142100, 144433, 149669, 153472, 158154, 161519, 167879, 168162, 175784, 176525, 183577, 184892, 191606, 193363, 196867, 204326, 204908, 212809, 213981, 220408, 221874, 228759, 230591, 236442, 239056, 244469, 247393, 252228, 255758, 260139, 942, 7307, 8897, 15844, 16752, 24149, 24607, 32570, 34322, 39223, 42877, 47192, 50380, 56297, 58787, 64134, 67798, 71667, 76217, 79516, 84488, 87341, 93031, 95298, 101738, 102991, 109573, 111392, 118708, 118929, 126683, 127486]); //#20813
        for (var id in $_) $_.hasOwnProperty(id) && (bwipp_qrcode.$ctx[id] = $_[id]); //#20813
        bwipp_qrcode.__20814__ = 1; //#20813
        $_ = Object.getPrototypeOf($_); //#20813
    } //#20813
    if ($eq($_.format, "full")) { //#20824
        $k[$j++] = 'ecid'; //#20816
        $search("MLHQ", $_.eclevel); //#20816
        $j--; //#20816
        var _eq = $k[--$j]; //#20816
        var _er = $k[--$j]; //#20816
        $k[$j++] = _eq.length; //#20816
        $k[$j++] = _er; //#20816
        $j--; //#20816
        var _es = $k[--$j]; //#20816
        var _et = $k[--$j]; //#20816
        $k[$j++] = _es; //#20816
        $k[$j++] = _et; //#20816
        $j--; //#20816
        var _eu = $k[--$j]; //#20816
        $_[$k[--$j]] = _eu; //#20816
        $_.fmtval = $get($_.fmtvalsfull, ($_.ecid << 3) + $_.bestmaskval); //#20817
        for (var _f2 = 0, _f1 = $_.formatmap.length - 1; _f2 <= _f1; _f2 += 1) { //#20823
            $_.i = _f2; //#20819
            $forall($get($_.formatmap, $_.i), function() { //#20822
                var _f7 = $k[--$j]; //#20821
                $k[$j++] = $_.pixs; //#20821
                $aload(_f7); //#20821
                $_.qmv(); //#20821
                var _f8 = $_.fmtval; //#20821
                var _fA = -(14 - $_.i); //#20821
                var _fB = $k[--$j]; //#20821
                $put($k[--$j], _fB, ((_fA < 0 ? _f8 >>> -_fA : _f8 << _fA)) & 1); //#20821
            }); //#20821
        } //#20821
    } //#20821
    if ($eq($_.format, "micro")) { //#20832
        $_.symid = $get($get($a([$a([0]), $a([1, 2]), $a([3, 4]), $a([5, 6, 7])]), ~~($f($_.cols - 11) / 2)), $_.eclval); //#20826
        $_.fmtval = $get($_.fmtvalsmicro, ($_.symid << 2) + $_.bestmaskval); //#20827
        for (var _fT = 0, _fS = $_.formatmap.length - 1; _fT <= _fS; _fT += 1) { //#20831
            $_.i = _fT; //#20829
            $k[$j++] = $_.pixs; //#20830
            $aload($get($get($_.formatmap, $_.i), 0)); //#20830
            $_.qmv(); //#20830
            var _fZ = $_.fmtval; //#20830
            var _fb = -(14 - $_.i); //#20830
            var _fc = $k[--$j]; //#20830
            $put($k[--$j], _fc, ((_fb < 0 ? _fZ >>> -_fb : _fZ << _fb)) & 1); //#20830
        } //#20830
    } //#20830
    if ($eq($_.format, "rmqr")) { //#20842
        $k[$j++] = 'fmtvalu'; //#20834
        $search("MH", $_.eclevel); //#20834
        $j--; //#20834
        var _fg = $k[--$j]; //#20834
        var _fh = $k[--$j]; //#20834
        $k[$j++] = _fg.length; //#20834
        $k[$j++] = _fh; //#20834
        $j--; //#20834
        var _fi = $k[--$j]; //#20834
        var _fj = $k[--$j]; //#20834
        $k[$j++] = _fi; //#20834
        $k[$j++] = _fj; //#20834
        $j--; //#20834
        var _fk = $k[--$j]; //#20834
        $_[$k[--$j]] = (_fk << 5) + $_.verind; //#20834
        $_.fmtval1 = $get($_.fmtvalsrmqr1, $_.fmtvalu); //#20835
        $_.fmtval2 = $get($_.fmtvalsrmqr2, $_.fmtvalu); //#20836
        for (var _fv = 0, _fu = $_.formatmap.length - 1; _fv <= _fu; _fv += 1) { //#20841
            $_.i = _fv; //#20838
            $k[$j++] = $_.pixs; //#20839
            $aload($get($get($_.formatmap, $_.i), 0)); //#20839
            $_.qmv(); //#20839
            var _g1 = $_.fmtval1; //#20839
            var _g3 = -(17 - $_.i); //#20839
            var _g4 = $k[--$j]; //#20839
            $put($k[--$j], _g4, ((_g3 < 0 ? _g1 >>> -_g3 : _g1 << _g3)) & 1); //#20839
            $k[$j++] = $_.pixs; //#20840
            $aload($get($get($_.formatmap, $_.i), 1)); //#20840
            $_.qmv(); //#20840
            var _gB = $_.fmtval2; //#20840
            var _gD = -(17 - $_.i); //#20840
            var _gE = $k[--$j]; //#20840
            $put($k[--$j], _gE, ((_gD < 0 ? _gB >>> -_gD : _gB << _gD)) & 1); //#20840
        } //#20840
    } //#20840
    if (!bwipp_qrcode.__20853__) { //#20853
        $_ = Object.create($_); //#20853
        $_.vervals = $a([31892, 34236, 39577, 42195, 48118, 51042, 55367, 58893, 63784, 68472, 70749, 76311, 79154, 84390, 87683, 92361, 96236, 102084, 102881, 110507, 110734, 117786, 119615, 126325, 127568, 133589, 136944, 141498, 145311, 150283, 152622, 158308, 161089, 167017]); //#20852
        for (var id in $_) $_.hasOwnProperty(id) && (bwipp_qrcode.$ctx[id] = $_[id]); //#20852
        bwipp_qrcode.__20853__ = 1; //#20852
        $_ = Object.getPrototypeOf($_); //#20852
    } //#20852
    if ($eq($_.format, "full") && ($_.cols >= 45)) { //#20862
        $_.verval = $get($_.vervals, (~~($f($_.cols - 17) / 4)) - 7); //#20855
        for (var _gP = 0, _gO = $_.versionmap.length - 1; _gP <= _gO; _gP += 1) { //#20861
            $_.i = _gP; //#20857
            $forall($get($_.versionmap, $_.i), function() { //#20860
                var _gU = $k[--$j]; //#20859
                $k[$j++] = $_.pixs; //#20859
                $forall(_gU); //#20859
                $_.qmv(); //#20859
                var _gV = $_.verval; //#20859
                var _gX = -(17 - $_.i); //#20859
                var _gY = $k[--$j]; //#20859
                $put($k[--$j], _gY, ((_gX < 0 ? _gV >>> -_gX : _gV << _gX)) & 1); //#20859
            }); //#20859
        } //#20859
    } //#20859
    var _gg = new Map([
        ["ren", bwipp_renmatrix],
        ["pixs", $_.pixs],
        ["pixx", $_.cols],
        ["pixy", $_.rows],
        ["height", ($_.rows * 2) / 72],
        ["width", ($_.cols * 2) / 72],
        ["opt", $_.options]
    ]); //#20872
    $k[$j++] = _gg; //#20875
    if (!$_.dontdraw) { //#20875
        bwipp_renmatrix(); //#20875
    } //#20875
    $_ = Object.getPrototypeOf($_); //#20877
    $_ = Object.getPrototypeOf($_); //#20879
}

var BWIPP_VERSION = '2023-04-03';
export { bwipp_qrcode,bwipp_encode,BWIPP_VERSION };
