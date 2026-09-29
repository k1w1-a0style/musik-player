import { execFileSync } from 'child_process';
import path from 'path';

test('Metro rejects unsupported parser payloads while preserving PNG assets', () => {
  const configPath = path.resolve(__dirname, '..', 'metro.config.js');
  const assetsPath = require.resolve('metro/private/Assets');
  const probe = `
    const { getAssetSize } = require(${JSON.stringify(assetsPath)});
    require(${JSON.stringify(configPath)});
    const payloads = {
      icns: Buffer.from([0x69,0x63,0x6e,0x73,0,0,0,16,0x69,0x63,0x30,0x37,0,0,0,0]),
      heif: Buffer.from([0,0,0,16,0x66,0x74,0x79,0x70,0x68,0x65,0x69,0x63,0,0,0,0]),
      jxl: Buffer.from([0,0,0,12,0x4a,0x58,0x4c,0x20,0x0d,0x0a,0x87,0x0a,0,0,0,16,0x66,0x74,0x79,0x70,0x6a,0x78,0x6c,0x20,0,0,0,0]),
      jxlStream: Buffer.from([0xff,0x0a,0,0,0,0,0,0]),
    };
    const blocked = Object.fromEntries(Object.entries(payloads).map(([type, payload]) => {
      try { getAssetSize('png', payload, 'disguised.png'); return [type, 'accepted']; }
      catch (error) { return [type, error.message]; }
    }));
    const png = getAssetSize('png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'), 'pixel.png');
    process.stdout.write(JSON.stringify({ blocked, png }));
  `;

  const output = execFileSync(process.execPath, ['-e', probe], {
    encoding: 'utf8',
    timeout: 2_000,
  });
  const result = JSON.parse(output) as {
    blocked: Record<string, string>;
    png: { width: number; height: number; type?: string };
  };

  expect(result.blocked).toEqual({
    heif: 'Invalid png image asset: disguised.png',
    icns: 'Invalid png image asset: disguised.png',
    jxl: 'Invalid png image asset: disguised.png',
    jxlStream: 'Invalid png image asset: disguised.png',
  });
  expect(result.png).toMatchObject({ width: 1, height: 1 });
});
