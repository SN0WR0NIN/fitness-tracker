#!/usr/bin/env node
'use strict';
// This is an OFFLINE pack/verify utility, not a production downloader. First
// copy approved storage objects into a private local directory by an authorized
// provider export. No service keys, public links or external network are used.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function filesUnder(root) {
  const found = [];
  function walk(directory) {
    for (const name of fs.readdirSync(directory).sort()) {
      const file = path.join(directory, name); const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) throw new Error('Symlinks are not supported.');
      if (stat.isDirectory()) walk(file);
      else if (stat.isFile()) { if (stat.size > 16 * 1024 * 1024) throw new Error('Object exceeds archive limit.'); found.push(file); }
      else throw new Error('Only regular files are supported.');
    }
  }
  if (!fs.lstatSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink()) throw new Error('Input must be a real directory.');
  walk(root); return found;
}
function pack(source, destination) {
  source = path.resolve(source); destination = path.resolve(destination);
  if (destination === source || destination.startsWith(source + path.sep) || fs.existsSync(destination)) throw new Error('Choose a new destination outside the source.');
  const files = filesUnder(source);
  if (!files.length) throw new Error('Refusing an empty object archive.');
  fs.mkdirSync(destination, { mode: 0o700 }); fs.mkdirSync(path.join(destination, 'objects'), { mode: 0o700 });
  const objects = files.map(file => {
    const relative = path.relative(source, file).split(path.sep).join('/');
    const bucket = relative.split('/')[0]; const key = relative.slice(bucket.length + 1);
    if (!['activity-proofs','profile-photos'].includes(bucket) || !key || relative.includes('..')) throw new Error('Place files under activity-proofs/ or profile-photos/.');
    const bytes = fs.readFileSync(file); const sha256 = digest(bytes);
    const blob = `objects/${sha256}`;
    if (!fs.existsSync(path.join(destination, blob))) fs.writeFileSync(path.join(destination, blob), bytes, { mode: 0o600, flag: 'wx' });
    return { bucket, key, blob, size: bytes.length, sha256 };
  });
  const manifest = { format: 'kg-private-media-archive', version: 1, createdAt: new Date().toISOString(), objects };
  const bytes = Buffer.from(JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(destination, 'manifest.json'), bytes, { mode: 0o600, flag: 'wx' });
  fs.writeFileSync(path.join(destination, 'manifest.sha256'), digest(bytes), { mode: 0o600, flag: 'wx' });
  return verify(destination);
}
function verify(directory) {
  directory = path.resolve(directory);
  filesUnder(directory); // includes manifest/digest; rejects symlinks before reads
  const raw = fs.readFileSync(path.join(directory, 'manifest.json'));
  if (raw.length > 16 * 1024 * 1024 || digest(raw) !== fs.readFileSync(path.join(directory, 'manifest.sha256'), 'utf8').trim()) throw new Error('Manifest integrity failure.');
  const manifest = JSON.parse(raw);
  if (manifest.format !== 'kg-private-media-archive' || manifest.version !== 1 || !Array.isArray(manifest.objects) || !manifest.objects.length) throw new Error('Invalid manifest.');
  const keys = new Set();
  for (const object of manifest.objects) {
    if (!['activity-proofs','profile-photos'].includes(object.bucket) || typeof object.key !== 'string' || !object.key || object.key.split('/').some(k => !k || k === '..' || k === '.') || object.key.includes('\\') || !/^[a-f0-9]{64}$/.test(object.sha256) || object.blob !== `objects/${object.sha256}`) throw new Error('Invalid object reference.');
    const id = `${object.bucket}/${object.key}`;
    if (keys.has(id)) throw new Error('Duplicate object key.'); keys.add(id);
    const bytes = fs.readFileSync(path.join(directory, object.blob));
    if (bytes.length !== object.size || digest(bytes) !== object.sha256) throw new Error('Missing or changed object.');
  }
  return { verified: true, objects: keys.size, binaryObjectsIncluded: true, encrypted: false, coverageOfLiveBucketVerified: false };
}
module.exports = { pack, verify };
if (require.main === module) {
  try {
    const action = process.argv[2];
    if (!['pack','verify'].includes(action)) throw new Error('Use pack SOURCE NEW_DEST or verify ARCHIVE.');
    console.log(JSON.stringify(action === 'pack' ? pack(process.argv[3], process.argv[4]) : verify(process.argv[3])));
  } catch { console.error('Media archive refused or failed verification. Preserve the originals; inspect locally.'); process.exitCode = 1; }
}
