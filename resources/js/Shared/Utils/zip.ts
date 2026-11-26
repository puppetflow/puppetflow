interface ZipTextFile {
    path: string;
    content: string;
}

const encoder = new TextEncoder();

const crcTable = (() => {
    const table = new Uint32Array(256);

    for (let i = 0; i < 256; i += 1) {
        let value = i;

        for (let j = 0; j < 8; j += 1) {
            value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
        }

        table[i] = value >>> 0;
    }

    return table;
})();

const crc32 = (bytes: Uint8Array) => {
    let crc = 0xffffffff;

    for (let i = 0; i < bytes.length; i += 1) {
        crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
};

const writeUint16 = (bytes: number[], value: number) => {
    bytes.push(value & 0xff, (value >>> 8) & 0xff);
};

const writeUint32 = (bytes: number[], value: number) => {
    bytes.push(
        value & 0xff,
        (value >>> 8) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 24) & 0xff,
    );
};

const appendBytes = (target: number[], bytes: Uint8Array) => {
    for (let i = 0; i < bytes.length; i += 1) {
        target.push(bytes[i]);
    }
};

export const createZipBlob = (files: ZipTextFile[]) => {
    const output: number[] = [];
    const centralDirectory: number[] = [];

    files.forEach(file => {
        const filenameBytes = encoder.encode(file.path);
        const contentBytes = encoder.encode(file.content);
        const checksum = crc32(contentBytes);
        const localHeaderOffset = output.length;

        writeUint32(output, 0x04034b50);
        writeUint16(output, 20);
        writeUint16(output, 0x0800);
        writeUint16(output, 0);
        writeUint16(output, 0);
        writeUint16(output, 0);
        writeUint32(output, checksum);
        writeUint32(output, contentBytes.length);
        writeUint32(output, contentBytes.length);
        writeUint16(output, filenameBytes.length);
        writeUint16(output, 0);
        appendBytes(output, filenameBytes);
        appendBytes(output, contentBytes);

        writeUint32(centralDirectory, 0x02014b50);
        writeUint16(centralDirectory, 20);
        writeUint16(centralDirectory, 20);
        writeUint16(centralDirectory, 0x0800);
        writeUint16(centralDirectory, 0);
        writeUint16(centralDirectory, 0);
        writeUint16(centralDirectory, 0);
        writeUint32(centralDirectory, checksum);
        writeUint32(centralDirectory, contentBytes.length);
        writeUint32(centralDirectory, contentBytes.length);
        writeUint16(centralDirectory, filenameBytes.length);
        writeUint16(centralDirectory, 0);
        writeUint16(centralDirectory, 0);
        writeUint16(centralDirectory, 0);
        writeUint16(centralDirectory, 0);
        writeUint32(centralDirectory, 0);
        writeUint32(centralDirectory, localHeaderOffset);
        appendBytes(centralDirectory, filenameBytes);
    });

    const centralDirectoryOffset = output.length;
    output.push(...centralDirectory);

    writeUint32(output, 0x06054b50);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint16(output, files.length);
    writeUint16(output, files.length);
    writeUint32(output, centralDirectory.length);
    writeUint32(output, centralDirectoryOffset);
    writeUint16(output, 0);

    return new Blob([new Uint8Array(output)], { type: 'application/zip' });
};

const decoder = new TextDecoder();

const inflateRaw = async (bytes: Uint8Array<ArrayBuffer>) => {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
};

// Reads the text files of a ZIP archive (stored or deflated entries; directories are skipped).
export const readZipTextFiles = async (data: ArrayBuffer): Promise<ZipTextFile[]> => {
    const bytes = new Uint8Array(data);
    const view = new DataView(data);
    let endOffset = -1;
    for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
        if (view.getUint32(offset, true) === 0x06054b50) {
            endOffset = offset;
            break;
        }
    }
    if (endOffset < 0) throw new Error('This file is not a valid ZIP archive.');

    const entryCount = view.getUint16(endOffset + 10, true);
    let offset = view.getUint32(endOffset + 16, true);
    const files: ZipTextFile[] = [];

    for (let index = 0; index < entryCount; index += 1) {
        if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('This ZIP archive is corrupted.');
        const method = view.getUint16(offset + 10, true);
        const compressedSize = view.getUint32(offset + 20, true);
        const nameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const localHeaderOffset = view.getUint32(offset + 42, true);
        const path = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
        offset += 46 + nameLength + extraLength + commentLength;

        if (path.endsWith('/')) continue;
        if (method !== 0 && method !== 8) throw new Error(`Unsupported compression for "${path}" in this ZIP archive.`);

        const localNameLength = view.getUint16(localHeaderOffset + 26, true);
        const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
        const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
        const content = bytes.subarray(dataStart, dataStart + compressedSize);
        files.push({
            path,
            content: decoder.decode(method === 8 ? await inflateRaw(content) : content),
        });
    }

    return files;
};
