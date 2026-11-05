/* RSA with small primes (SPEC-v4 §4.25), Tanenbaum's notation: n = pq, z = (p−1)(q−1),
   d coprime to z, e·d ≡ 1 (mod z). C = P^e mod n, P = C^d mod n. BigInt arithmetic;
   letters map A = 1 … Z = 26, so n must exceed 26. */
(function (G) {
  'use strict';
  var CN = G.CN = G.CN || {};

  function isPrime(n) {
    if (n < 2 || n !== Math.floor(n)) return false;
    for (var i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return true;
  }
  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }
  // Extended Euclid: inverse of a mod m, or null.
  function modInverse(a, m) {
    var r0 = m, r1 = a % m, t0 = 0, t1 = 1;
    while (r1) { var q = Math.floor(r0 / r1), r = r0 - q * r1; r0 = r1; r1 = r; var t = t0 - q * t1; t0 = t1; t1 = t; }
    if (r0 !== 1) return null;
    return ((t0 % m) + m) % m;
  }
  function num(v) { var t = String(v == null ? '' : v).trim(); return /^\d+$/.test(t) ? +t : NaN; }

  // Returns { n, z, d, e } or { error, field }.
  function keygen(p, q, d) {
    p = num(p); q = num(q); d = num(d);
    if (!isPrime(p)) return { error: 'p = ' + (isNaN(p) ? '?' : p) + ' is not prime', field: 'p' };
    if (!isPrime(q)) return { error: 'q = ' + (isNaN(q) ? '?' : q) + ' is not prime', field: 'q' };
    if (p > 997 || q > 997) return { error: 'Use primes up to 997', field: p > 997 ? 'p' : 'q' };
    if (p === q) return { error: 'p = q: then n = p², and (p−1)² isn\'t the count of numbers coprime to n', field: 'q' };
    var n = p * q, z = (p - 1) * (q - 1);
    if (n <= 26) return { error: 'n = ' + n + ' ≤ 26: the letters A = 1 … Z = 26 must all be below n', field: 'q' };
    if (isNaN(d) || d < 2 || d >= z) return { error: 'd must be between 2 and z − 1 = ' + (z - 1), field: 'd' };
    if (gcd(d, z) !== 1) return { error: 'gcd(d, z) = gcd(' + d + ', ' + z + ') = ' + gcd(d, z) + ' ≠ 1: no e exists', field: 'd' };
    return { p: p, q: q, n: n, z: z, d: d, e: modInverse(d, z) };
  }

  // b^e mod m with the square-and-multiply steps (BigInt inside, numbers out).
  function modpow(b, e, m) {
    var B = BigInt(b), M = BigInt(m), r = 1n, x = B % M, steps = [], bits = e.toString(2);
    var E = BigInt(e);
    var full = bits.length <= 6 ? B ** E : null;    // show the whole power while it's small enough to read
    for (var i = 0; i < bits.length; i++) {
      r = (r * r) % M;
      if (bits[i] === '1') r = (r * x) % M;
      steps.push({ bit: bits[i], value: Number(r) });
    }
    return { value: Number(r), bits: bits, steps: steps, full: full != null && full < 10n ** 20n ? full.toString() : null };
  }

  // The same square-and-multiply as hops round a dial of n positions: start at b (the leading 1 bit),
  // then for each later bit square, and on a 1 multiply by b. Ends at modpow(b, e, m).value.
  function hops(b, e, m) {
    var M = BigInt(m), x = BigInt(b) % M, r = x, bits = e.toString(2), out = [{ op: 'start', bit: 0, from: null, to: Number(r), label: 'start at ' + Number(r) }];
    for (var i = 1; i < bits.length; i++) {
      var sq = (r * r) % M;
      out.push({ op: 'square', bit: i, from: Number(r), to: Number(sq), label: Number(r) + '² mod ' + m + ' = ' + Number(sq) });
      r = sq;
      if (bits[i] === '1') {
        var mu = (r * x) % M;
        out.push({ op: 'multiply', bit: i, from: Number(r), to: Number(mu), label: Number(r) + '·' + Number(x) + ' mod ' + m + ' = ' + Number(mu) });
        r = mu;
      }
    }
    return { bits: bits, hops: out, value: Number(r) };
  }
  // SPEC-v6 "your numbers" on S25: 'p q d', checked by keygen's rules.
  function parseKey(input) {
    var t = String(input == null ? '' : input).trim().split(/[\s,]+/).filter(Boolean);
    if (t.length !== 3) return { error: 'Type three numbers: p q d (e.g. 3 11 7)' };
    return keygen(t[0], t[1], t[2]);
  }

  function letters(text) {
    var t = String(text).toUpperCase().replace(/[^A-Z]/g, '');
    return t.split('').map(function (c) { return c.charCodeAt(0) - 64; });
  }
  function encrypt(nums, key) { return nums.map(function (P) { return modpow(P, key.e, key.n); }); }
  function decrypt(nums, key) { return nums.map(function (C) { return modpow(C, key.d, key.n); }); }

  CN.rsa = { isPrime: isPrime, gcd: gcd, modInverse: modInverse, keygen: keygen, parseKey: parseKey, modpow: modpow, hops: hops, DIAL_MAX: 150, letters: letters, encrypt: encrypt, decrypt: decrypt };
})(typeof window !== 'undefined' ? window : globalThis);
