/**
 * Minimal Protobuf decoder for Google Safe Browsing v5 API response
 * Handles the specific structure we need without external dependencies
 */

export class ProtobufDecoder {
  /**
   * Read and decode a varint (variable-length integer)
   * Returns [value, nextOffset]
   */
  static readVarint(buffer: Buffer, offset: number): [number, number] {
    let value = 0;
    let shift = 0;

    while (offset < buffer.length) {
      const byte = buffer[offset++];
      value |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
    }

    return [value, offset];
  }

  /**
   * Decode a length-delimited field
   * Returns [data, nextOffset]
   */
  static readLengthDelimited(buffer: Buffer, offset: number): [Buffer, number] {
    const [length, newOffset] = this.readVarint(buffer, offset);
    const data = buffer.slice(newOffset, newOffset + length);
    return [data, newOffset + length];
  }

  /**
   * Decode HashSearchResponse from Protobuf buffer
   * Google Safe Browsing v5 API response structure:
   * - Field 1: repeated FullHash messages
   * - Field 2: unknown (likely cache-related metadata, we skip it)
   */
  static decodeHashSearchResponse(buffer: Buffer): {
    fullHashes: Array<{
      fullHash: Buffer;
      details: Array<{ threatType: number }>;
    }>;
    cacheDuration: string;
  } {
    const result = {
      fullHashes: [] as Array<{
        fullHash: Buffer;
        details: Array<{ threatType: number }>;
      }>,
      cacheDuration: '3600s', // Default cache duration (1 hour)
    };

    let offset = 0;

    while (offset < buffer.length) {
      const [tagAndType, newOffset] = this.readVarint(buffer, offset);
      offset = newOffset;

      const fieldNumber = tagAndType >> 3;
      const wireType = tagAndType & 0x07;

      if (fieldNumber === 1 && wireType === 2) {
        // fullHashes field (repeated FullHash)
        const [data, nextOffset] = this.readLengthDelimited(buffer, offset);
        offset = nextOffset;

        const fullHash = this.decodeFullHash(data);
        result.fullHashes.push(fullHash);
      } else {
        // Skip unknown or non-critical fields (e.g., field 2 which contains metadata)
        if (wireType === 0) {
          const [, newOff] = this.readVarint(buffer, offset);
          offset = newOff;
        } else if (wireType === 2) {
          const [, newOff] = this.readLengthDelimited(buffer, offset);
          offset = newOff;
        }
      }
    }

    return result;
  }

  /**
   * Decode UrlSearchResponse from Protobuf buffer
   * Google Safe Browsing v5 API urls:search response structure:
   * - Field 1: repeated ThreatUrl messages (threats)
   * - Field 2: cacheDuration (Duration format or encoded differently)
   */
  static decodeUrlSearchResponse(buffer: Buffer): {
    threats: Array<{ url: string; threatTypes: number[] }>;
    cacheDuration: string;
  } {
    const result = {
      threats: [] as Array<{ url: string; threatTypes: number[] }>,
      cacheDuration: '3600s', // Default cache duration (1 hour)
    };

    console.log('DEBUG: Buffer hex:', buffer.toString('hex'));
    console.log('DEBUG: Buffer length:', buffer.length);

    let offset = 0;

    while (offset < buffer.length) {
      const [tagAndType, newOffset] = this.readVarint(buffer, offset);
      offset = newOffset;

      const fieldNumber = tagAndType >> 3;
      const wireType = tagAndType & 0x07;

      console.log(
        `DEBUG: Field ${fieldNumber}, WireType ${wireType}, offset ${newOffset}`,
      );

      if (fieldNumber === 1 && wireType === 2) {
        // threats field (repeated ThreatUrl)
        const [data, nextOffset] = this.readLengthDelimited(buffer, offset);
        offset = nextOffset;

        const threat = this.decodeThreatUrl(data);
        result.threats.push(threat);
      } else if (fieldNumber === 2 && wireType === 2) {
        // cacheDuration field (nested Duration message)
        const [data, nextOffset] = this.readLengthDelimited(buffer, offset);
        offset = nextOffset;

        // Duration message format: field 1 = seconds (varint)
        // Byte: 08ac02 -> 08 (field 1, wire type 0) -> ac02 (varint)
        if (data[0] === 0x08) {
          // Field 1, wire type 0 (varint) - this is seconds in Duration protobuf message
          const [seconds] = this.readVarint(data, 1);
          result.cacheDuration = `${seconds}s`;
          console.log('DEBUG: Parsed Duration message, seconds:', seconds);
        } else {
          // Fallback: treat as string
          result.cacheDuration = data.toString('utf8');
        }
        console.log('DEBUG: Cache duration bytes:', data.toString('hex'));
        console.log('DEBUG: Final cache duration:', result.cacheDuration);
      } else if (fieldNumber === 2 && wireType === 0) {
        // cacheDuration might be encoded as varint (seconds)
        const [seconds, nextOffset] = this.readVarint(buffer, offset);
        offset = nextOffset;
        result.cacheDuration = `${seconds}s`;
        console.log('DEBUG: Cache duration (varint):', seconds);
      } else {
        // Skip unknown fields
        if (wireType === 0) {
          const [, newOff] = this.readVarint(buffer, offset);
          offset = newOff;
        } else if (wireType === 2) {
          const [, newOff] = this.readLengthDelimited(buffer, offset);
          offset = newOff;
        }
      }
    }

    return result;
  }

  /**
   * Decode ThreatUrl message
   */
  private static decodeThreatUrl(buffer: Buffer): {
    url: string;
    threatTypes: number[];
  } {
    const result = {
      url: '',
      threatTypes: [] as number[],
    };

    let offset = 0;

    while (offset < buffer.length) {
      const [tagAndType, newOffset] = this.readVarint(buffer, offset);
      offset = newOffset;

      const fieldNumber = tagAndType >> 3;
      const wireType = tagAndType & 0x07;

      if (fieldNumber === 1 && wireType === 2) {
        // url field (string)
        const [data, nextOffset] = this.readLengthDelimited(buffer, offset);
        offset = nextOffset;
        result.url = data.toString('utf8');
      } else if (fieldNumber === 2 && wireType === 0) {
        // threatTypes field (repeated varint/enum)
        const [value, nextOffset] = this.readVarint(buffer, offset);
        offset = nextOffset;
        result.threatTypes.push(value);
      } else if (fieldNumber === 2 && wireType === 2) {
        // threatTypes field packed format
        const [data, nextOffset] = this.readLengthDelimited(buffer, offset);
        offset = nextOffset;

        let dataOffset = 0;
        while (dataOffset < data.length) {
          const [value, newDataOffset] = this.readVarint(data, dataOffset);
          dataOffset = newDataOffset;
          result.threatTypes.push(value);
        }
      } else {
        // Skip unknown fields
        if (wireType === 0) {
          const [, newOff] = this.readVarint(buffer, offset);
          offset = newOff;
        } else if (wireType === 2) {
          const [, newOff] = this.readLengthDelimited(buffer, offset);
          offset = newOff;
        }
      }
    }

    return result;
  }

  /**
   * Decode FullHash message
   */
  private static decodeFullHash(buffer: Buffer): {
    fullHash: Buffer;
    details: Array<{ threatType: number }>;
  } {
    const result = {
      fullHash: Buffer.alloc(0),
      details: [] as Array<{ threatType: number }>,
    };

    let offset = 0;

    while (offset < buffer.length) {
      const [tagAndType, newOffset] = this.readVarint(buffer, offset);
      offset = newOffset;

      const fieldNumber = tagAndType >> 3;
      const wireType = tagAndType & 0x07;

      if (fieldNumber === 1 && wireType === 2) {
        // fullHash field (bytes)
        const [data, nextOffset] = this.readLengthDelimited(buffer, offset);
        offset = nextOffset;
        result.fullHash = Buffer.from(data);
      } else if (fieldNumber === 2 && wireType === 2) {
        // fullHashDetails field (repeated)
        const [data, nextOffset] = this.readLengthDelimited(buffer, offset);
        offset = nextOffset;

        const detail = this.decodeFullHashDetail(data);
        result.details.push(detail);
      }
    }

    return result;
  }

  /**
   * Decode FullHashDetail message
   */
  private static decodeFullHashDetail(buffer: Buffer): { threatType: number } {
    let offset = 0;

    while (offset < buffer.length) {
      const [tagAndType, newOffset] = this.readVarint(buffer, offset);
      offset = newOffset;

      const fieldNumber = tagAndType >> 3;
      const wireType = tagAndType & 0x07;

      if (fieldNumber === 1 && wireType === 0) {
        // threatType field (varint/enum)
        const [value, nextOffset] = this.readVarint(buffer, offset);
        offset = nextOffset;
        return { threatType: value };
      }
    }

    return { threatType: 1 }; // Default MALWARE
  }
}
