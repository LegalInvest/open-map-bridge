export class BoundedReader {
  private readonly view: DataView;
  private readonly bytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  u32(offset: number, code = 'FORMAT_RECORD_BOUNDS'): number {
    if (!Number.isInteger(offset) || offset < 0 || offset + 4 > this.bytes.length) throw new Error(code);
    return this.view.getUint32(offset, true);
  }

  slice(offset: number, length: number, code = 'FORMAT_RECORD_BOUNDS'): Uint8Array {
    if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length < 0 || offset + length > this.bytes.length) {
      throw new Error(code);
    }
    return this.bytes.subarray(offset, offset + length);
  }
}
