/*
 * libsodium-compatible sealed box (crypto_box_seal), the format GitHub requires
 * for repository secrets. Built on tweetnacl (X25519 + XSalsa20-Poly1305) and
 * blakejs (BLAKE2b), so the page does not need the 1 MB libsodium build.
 *
 *   sealed = ephemeralPublicKey(32) || nacl.box(message, nonce, recipientPk, ephemeralSk)
 *   nonce  = BLAKE2b-192(ephemeralPublicKey || recipientPk)
 *
 * Works in the browser (globals `nacl`, `blakejs`) and in Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('tweetnacl'), require('blakejs'));
  } else {
    root.SealedBox = factory(root.nacl, root.blakejs);
  }
})(typeof self !== 'undefined' ? self : this, function (nacl, blakejs) {
  'use strict';

  function concat(a, b) {
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
  }

  function seal(message, recipientPublicKey) {
    if (!(recipientPublicKey instanceof Uint8Array) || recipientPublicKey.length !== 32) {
      throw new Error('recipient public key must be 32 bytes');
    }
    const eph = nacl.box.keyPair();
    const nonce = blakejs.blake2b(concat(eph.publicKey, recipientPublicKey), undefined, 24);
    const boxed = nacl.box(message, nonce, recipientPublicKey, eph.secretKey);
    eph.secretKey.fill(0);
    return concat(eph.publicKey, boxed);
  }

  function toBase64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }

  function fromBase64(text) {
    const s = atob(text);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  /** Encrypt a UTF-8 secret for GitHub: returns base64 ciphertext. */
  function encryptSecret(secretText, githubPublicKeyBase64) {
    const pk = fromBase64(githubPublicKeyBase64);
    const msg = new TextEncoder().encode(secretText);
    return toBase64(seal(msg, pk));
  }

  return { seal, encryptSecret, toBase64, fromBase64 };
});
