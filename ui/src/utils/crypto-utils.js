/**
 * Base64文字列をUint8Arrayに変換します。
 */
export const base64ToBuffer = (base64) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const md5LeftRotate = (x, c) => (x << c) | (x >>> (32 - c));

/**
 * Uint8ArrayデータのMD5ハッシュを計算します。
 */
export const md5 = (data) => {
  const r = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9,
    14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const k = new Array(64);
  for (let i = 0; i < 64; i++) {
    k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000);
  }
  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  const padded = new Uint8Array(data.length + 1 + ((64 - ((data.length + 9) % 64)) % 64) + 8);
  padded.set(data);
  padded[data.length] = 0x80;
  const bitLen = BigInt(data.length) * BigInt(8);
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Number(bitLen & BigInt(0xffffffff)), true);
  view.setUint32(padded.length - 4, Number(bitLen >> BigInt(32)), true);
  for (let i = 0; i < padded.length; i += 64) {
    const w = new Uint32Array(16);
    for (let j = 0; j < 16; j++) {
      w[j] = view.getUint32(i + j * 4, true);
    }
    let a = h0,
      b = h1,
      c = h2,
      d = h3;
    for (let j = 0; j < 64; j++) {
      let f, g;
      if (j < 16) {
        f = (b & c) | (~b & d);
        g = j;
      } else if (j < 32) {
        f = (d & b) | (~d & c);
        g = (5 * j + 1) % 16;
      } else if (j < 48) {
        f = b ^ c ^ d;
        g = (3 * j + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * j) % 16;
      }
      const temp = d;
      d = c;
      c = b;
      b = (b + md5LeftRotate((a + f + k[j] + w[g]) | 0, r[j])) | 0;
      a = temp;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
  }
  const result = new Uint8Array(16);
  const view2 = new DataView(result.buffer);
  view2.setUint32(0, h0, true);
  view2.setUint32(4, h1, true);
  view2.setUint32(8, h2, true);
  view2.setUint32(12, h3, true);
  return Array.from(result)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Base64データのMD5ハッシュを取得します。
 */
export const md5Hash = (base64Data) => {
  if (!base64Data) return 'N/A';
  try {
    return md5(base64ToBuffer(base64Data));
  } catch (e) {
    return 'Error';
  }
};

/**
 * Base64データのSHA-256ハッシュを非同期で計算します。
 */
export const sha256Hash = async (base64Data) => {
  if (!base64Data) return 'N/A';
  try {
    const data = base64ToBuffer(base64Data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (e) {
    return 'Error';
  }
};

export const mmh3Hash = (base64Data, seed = 0) => {
  if (!base64Data) return 'N/A';
  try {
    // 1. 76文字ごとに改行区切りを挿入し、末尾にも改行を追加する（Pythonのencodebytes仕様）
    const formattedBase64 = base64Data.match(/.{1,76}/g).join('\n') + '\n';

    // 2. 整形済みの文字列をUTF-8バイト列に変換
    const encoder = new TextEncoder();
    const data = encoder.encode(formattedBase64);
    
    // 3. MurmurHash3を適用
    const unsignedHash = murmurhash3_32(data, seed);
    
    // 4. 符号付き32bit整数に変換（Pythonと同じ形式）
    const signedHash = unsignedHash | 0;  // ビット演算で符号付きに変換
    
    return signedHash.toString();
  } catch (e) {
    console.error('mmh3Hash error:', e);
    return 'Error';
  }
};

/**
 * MurmurHash3 32bit実装
 * https://github.com/garycourt/murmurhash-js を参考
 */
const murmurhash3_32 = (data, seed = 0) => {
  const length = data.length;
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  
  let h1 = seed;
  let offset = 0;
  
  // 4バイト単位でハッシュ処理
  while (offset + 4 <= length) {
    let k1 = 
      ((data[offset] & 0xff)) |
      ((data[offset + 1] & 0xff) << 8) |
      ((data[offset + 2] & 0xff) << 16) |
      ((data[offset + 3] & 0xff) << 24);
    offset += 4;
    
    // k1 *= c1
    k1 = (((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
    // k1 = rotl32(k1, 15)
    k1 = (k1 << 15) | (k1 >>> 17);
    // k1 *= c2
    k1 = (((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
    
    h1 ^= k1;
    // h1 = rotl32(h1, 13)
    h1 = (h1 << 13) | (h1 >>> 19);
    // h1 = h1*5 + 0xe6546b64
    const h1b = ((((h1 & 0xffff) * 5) + ((((h1 >>> 16) * 5) & 0xffff) << 16))) & 0xffffffff;
    h1 = (((h1b & 0xffff) + 0x6b64) + ((((h1b >>> 16) + 0xe654) & 0xffff) << 16));
  }
  
  // 残りのバイト（0-3バイト）を処理
  let k1 = 0;
  const remainder = length & 3;
  
  switch (remainder) {
    case 3:
      k1 ^= (data[offset + 2] & 0xff) << 16;
    case 2:
      k1 ^= (data[offset + 1] & 0xff) << 8;
    case 1:
      k1 ^= (data[offset] & 0xff);
      
      // k1 *= c1
      k1 = (((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
      // k1 = rotl32(k1, 15)
      k1 = (k1 << 15) | (k1 >>> 17);
      // k1 *= c2
      k1 = (((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
      h1 ^= k1;
  }
  
  h1 ^= length;
  
  // fmix32
  h1 ^= h1 >>> 16;
  h1 = (((h1 & 0xffff) * 0x85ebca6b) + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
  h1 ^= h1 >>> 13;
  h1 = (((h1 & 0xffff) * 0xc2b2ae35) + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16)) & 0xffffffff;
  h1 ^= h1 >>> 16;
  
  return h1 >>> 0;
};