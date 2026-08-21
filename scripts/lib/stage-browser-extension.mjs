import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const BROWSER_EXTENSION_FILE = "RearvyBrowserRelay.zip";
export const BROWSER_EXTENSION_METADATA_FILE = "browser-extension.json";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRootDir = path.resolve(__dirname, "..", "..");
const ZIP_UTF8_FLAG = 0x0800;

let crcTable = null;

function getCrcTable() {
  if (crcTable) {
    return crcTable;
  }

  crcTable = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    crcTable[index] = value >>> 0;
  }

  return crcTable;
}

function crc32(buffer) {
  const table = getCrcTable();
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function dosTime(date) {
  return (
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2)
  );
}

function dosDate(date) {
  return (
    ((date.getFullYear() - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate()
  );
}

function writeUInt32(buffer, value, offset) {
  buffer.writeUInt32LE(value >>> 0, offset);
}

function collectExtensionFiles(sourceDir) {
  const files = [];
  const pending = [sourceDir];

  while (pending.length > 0) {
    const currentDir = pending.pop();
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "__MACOSX") {
        continue;
      }

      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
        continue;
      }

      if (entry.isFile()) {
        files.push(entryPath);
      }
    }
  }

  return files.sort((left, right) =>
    path.relative(sourceDir, left).localeCompare(path.relative(sourceDir, right))
  );
}

function createLocalHeader(entry) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(ZIP_UTF8_FLAG, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(entry.time, 10);
  header.writeUInt16LE(entry.date, 12);
  writeUInt32(header, entry.crc, 14);
  writeUInt32(header, entry.size, 18);
  writeUInt32(header, entry.size, 22);
  header.writeUInt16LE(entry.name.length, 26);
  header.writeUInt16LE(0, 28);
  return header;
}

function createCentralHeader(entry) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(ZIP_UTF8_FLAG, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(entry.time, 12);
  header.writeUInt16LE(entry.date, 14);
  writeUInt32(header, entry.crc, 16);
  writeUInt32(header, entry.size, 20);
  writeUInt32(header, entry.size, 24);
  header.writeUInt16LE(entry.name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  writeUInt32(header, 0, 38);
  writeUInt32(header, entry.offset, 42);
  return header;
}

function createEndOfCentralDirectory(entryCount, centralSize, centralOffset) {
  const header = Buffer.alloc(22);
  header.writeUInt32LE(0x06054b50, 0);
  header.writeUInt16LE(0, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(entryCount, 8);
  header.writeUInt16LE(entryCount, 10);
  writeUInt32(header, centralSize, 12);
  writeUInt32(header, centralOffset, 16);
  header.writeUInt16LE(0, 20);
  return header;
}

function buildZip(sourceDir) {
  const localParts = [];
  const centralParts = [];
  const files = collectExtensionFiles(sourceDir);
  let offset = 0;

  for (const filePath of files) {
    const relativePath = path.relative(sourceDir, filePath).replace(/\\/g, "/");
    const data = fs.readFileSync(filePath);
    const name = Buffer.from(relativePath, "utf8");
    const stat = fs.statSync(filePath);
    const modifiedAt = stat.mtime < new Date("1980-01-01T00:00:00Z")
      ? new Date("1980-01-01T00:00:00Z")
      : stat.mtime;
    const entry = {
      name,
      data,
      size: data.length,
      crc: crc32(data),
      time: dosTime(modifiedAt),
      date: dosDate(modifiedAt),
      offset,
    };
    const localHeader = createLocalHeader(entry);
    localParts.push(localHeader, name, data);
    offset += localHeader.length + name.length + data.length;
    centralParts.push(createCentralHeader(entry), name);
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = createEndOfCentralDirectory(files.length, centralSize, centralOffset);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

function readManifest(sourceDir) {
  const manifestPath = path.join(sourceDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  return {
    name: typeof manifest.name === "string" ? manifest.name : "Rearvy Browser Relay",
    shortName: typeof manifest.short_name === "string" ? manifest.short_name : "Rearvy Relay",
    version: typeof manifest.version === "string" ? manifest.version : "0.0.0",
    manifestVersion: manifest.manifest_version,
  };
}

export function stageBrowserExtension(options = {}) {
  const rootDir = options.rootDir ? path.resolve(options.rootDir) : defaultRootDir;
  const sourceDir =
    options.sourceDir ||
    path.join(rootDir, "desktop-app", "resources", "chrome-extension", "rearvy-browser-relay");
  const targets =
    options.targets ||
    [
      path.join(rootDir, "website", "public", "downloads"),
      path.join(rootDir, "public", "downloads"),
    ];

  if (!fs.existsSync(path.join(sourceDir, "manifest.json"))) {
    throw new Error(`Rearvy browser extension source is missing: ${sourceDir}`);
  }

  const zipBuffer = buildZip(sourceDir);
  const manifest = readManifest(sourceDir);
  const sha256 = crypto.createHash("sha256").update(zipBuffer).digest("hex");
  const metadata = {
    name: manifest.name,
    shortName: manifest.shortName,
    version: manifest.version,
    manifestVersion: manifest.manifestVersion,
    file: BROWSER_EXTENSION_FILE,
    url: `/downloads/${BROWSER_EXTENSION_FILE}`,
    fileSizeBytes: zipBuffer.length,
    sha256,
    source: "desktop-app/resources/chrome-extension/rearvy-browser-relay",
  };

  for (const targetDir of targets) {
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, BROWSER_EXTENSION_FILE), zipBuffer);
    fs.writeFileSync(
      path.join(targetDir, BROWSER_EXTENSION_METADATA_FILE),
      `${JSON.stringify(metadata, null, 2)}\n`
    );
  }

  return {
    ...metadata,
    targets,
  };
}
