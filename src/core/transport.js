"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtoWriter = void 0;
exports.createConnectFrame = createConnectFrame;
const buffer_1 = require("buffer");
/**
 * Writer for manual Protobuf encoding.
 * Essential for communicating with restrictive gRPC/Connect backends without heavy dependencies.
 */
class ProtoWriter {
    constructor() {
        this.parts = [];
    }
    /**
     * Writes a variable-length integer (Varint).
     */
    writeVarint(v) {
        const b = [];
        while (v > 127) {
            b.push((v & 0x7f) | 0x80);
            v >>>= 7;
        }
        b.push(v & 0x7f);
        this.parts.push(buffer_1.Buffer.from(b));
    }
    /**
     * Writes a string field.
     */
    writeString(field, value) {
        const buf = buffer_1.Buffer.from(value, 'utf8');
        this.writeVarint((field << 3) | 2); // WireType 2 = Length-delimited
        this.writeVarint(buf.length);
        this.parts.push(buf);
    }
    /**
     * Writes a nested message field.
     */
    writeMessage(field, writer) {
        const buf = writer.toBuffer();
        this.writeVarint((field << 3) | 2);
        this.writeVarint(buf.length);
        this.parts.push(buf);
    }
    /**
     * Writes a 32-bit integer field.
     */
    writeInt32(field, value) {
        this.writeVarint((field << 3) | 0); // WireType 0 = Varint (technically int32 is varint encoded usually, or fixed32)
        // Note: Standard protobuf int32 is varint. fixed32 is WireType 5.
        // Based on reference implementation using writeVarint for int32.
        this.writeVarint(value);
    }
    toBuffer() {
        return buffer_1.Buffer.concat(this.parts);
    }
}
exports.ProtoWriter = ProtoWriter;
/**
 * Creates a Connect-RPC envelope frame.
 * Format: [CompressionFlag(1)] + [Length(4, BigEndian)] + [Payload]
 */
function createConnectFrame(payload, compressed = false) {
    const frame = buffer_1.Buffer.alloc(5 + payload.length);
    frame[0] = compressed ? 1 : 0;
    frame.writeUInt32BE(payload.length, 1);
    payload.copy(frame, 5);
    return frame;
}
