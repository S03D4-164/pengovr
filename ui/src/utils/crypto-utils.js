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
