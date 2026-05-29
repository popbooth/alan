/**
 * crypto.js — TIPS 加密模块 (Web Crypto API AES-GCM)
 * v2.0: API Key 加密 + 隐私数据加密
 */

const TIPSCrypto = {
  _key: null,

  /** 从 PIN 码派生 AES 密钥 */
  async deriveKey(pin, salt) {
    const s = salt || crypto.getRandomValues(new Uint8Array(16))
    const mk = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin.padEnd(16)), 'PBKDF2', false, ['deriveKey'])
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: s, iterations: 100000, hash: 'SHA-256' },
      mk,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
    return { key, salt: Array.from(s) }
  },

  /** 加密文本 */
  async encrypt(plaintext, pin) {
    const { key, salt } = await this.deriveKey(pin)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
    return {
      data: btoa(String.fromCharCode(...new Uint8Array(enc))),
      iv: Array.from(iv),
      salt,
    }
  },

  /** 解密文本 */
  async decrypt(packet, pin) {
    try {
      const { key } = await this.deriveKey(pin, new Uint8Array(packet.salt))
      const iv = new Uint8Array(packet.iv)
      const data = Uint8Array.from(atob(packet.data), c => c.charCodeAt(0))
      const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
      return new TextDecoder().decode(dec)
    } catch { return null }
  }
}

window.TIPSCrypto = TIPSCrypto
