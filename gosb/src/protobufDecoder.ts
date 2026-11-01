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
    fullHashes: Array<{ fullHash: Buffer; details: Array<{ threatType: number }> }>;
    cacheDuration: string;
  } {
    const result = {
      fullHashes: [] as Array<{ fullHash: Buffer; details: Array<{ threatType: number }> }>,
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
