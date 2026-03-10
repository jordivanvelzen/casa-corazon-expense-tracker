// Generate simple orange circle PWA icons with a house shape
import { writeFileSync } from "fs";
import { deflateSync } from "zlib";

function createPNG(size) {
  const pixels = [];
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size / 2;

  const orangeR = 249, orangeG = 115, orangeB = 22;
  const whiteR = 255, whiteG = 255, whiteB = 255;

  for (let y = 0; y < size; y++) {
    const row = [0]; // filter byte
    for (let x = 0; x < size; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        const nx = (x - centerX) / radius;
        const ny = (y - centerY) / radius;

        const inRoof = ny >= -0.45 && ny <= -0.05 && Math.abs(nx) <= (0.45 - (ny + 0.45));
        const inBody = ny >= -0.05 && ny <= 0.4 && Math.abs(nx) <= 0.3;
        const inDoor = ny >= 0.1 && ny <= 0.4 && Math.abs(nx) <= 0.1;

        if (inRoof || (inBody && !inDoor)) {
          row.push(whiteR, whiteG, whiteB, 255);
        } else {
          row.push(orangeR, orangeG, orangeB, 255);
        }
      } else {
        row.push(0, 0, 0, 0);
      }
    }
    pixels.push(Buffer.from(row));
  }

  const rawData = Buffer.concat(pixels);
  const compressed = deflateSync(rawData);

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
    }
    return c ^ 0xffffffff;
  }

  function createChunk(type, data) {
    const typeBuffer = Buffer.from(type);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = crc32(Buffer.concat([typeBuffer, data]));
    const crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32BE(crc >>> 0);
    return Buffer.concat([length, typeBuffer, data, crcBuffer]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    signature,
    createChunk("IHDR", ihdr),
    createChunk("IDAT", compressed),
    createChunk("IEND", Buffer.alloc(0)),
  ]);
}

writeFileSync("public/icon-192.png", createPNG(192));
writeFileSync("public/icon-512.png", createPNG(512));
console.log("Generated icon-192.png and icon-512.png");
