import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { compareLists, createResultsCsv, csvCell, filterExcluded, normalizeUsername, parseInstagramJsonFiles, parseInstagramZip, partitionAccounts } from './main.js';

const follower = (value) => ({ string_list_data: [{ value }] });
const following = (title) => ({ title });

describe('normalizeUsername', () => {
  it('normalizes valid Instagram usernames', () => {
    expect(normalizeUsername(' Amr.Mans0ur_ ')).toBe('amr.mans0ur_');
  });

  it('rejects malformed and oversized values', () => {
    expect(normalizeUsername('not a username')).toBeNull();
    expect(normalizeUsername('a'.repeat(31))).toBeNull();
    expect(normalizeUsername('=IMPORTXML("bad")')).toBeNull();
  });
});

describe('compareLists', () => {
  it('deduplicates, normalizes case, and finds non-followers', () => {
    const result = compareLists(
      [follower('Alice'), follower('alice'), follower('carol')],
      { relationships_following: [following('ALICE'), following('bob'), following('bob')] },
    );
    expect([...result.followers]).toEqual(['alice', 'carol']);
    expect([...result.following]).toEqual(['alice', 'bob']);
    expect(result.nonFollowers).toEqual(['bob']);
  });

  it('rejects an unexpected export schema', () => {
    expect(() => compareLists({}, { relationships_following: [] })).toThrow(/unexpected format/i);
    expect(() => compareLists([], {})).toThrow(/unexpected format/i);
  });
});

describe('csvCell', () => {
  it('quotes and escapes CSV values', () => {
    expect(csvCell('a"b')).toBe('"a""b"');
  });

  it('neutralizes spreadsheet formulas', () => {
    expect(csvCell('=1+1')).toBe('"\'=1+1"');
    expect(csvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
  });
});

describe('filterExcluded', () => {
  it('removes browser-local exclusions from displayed and downloaded results', () => {
    expect(filterExcluded(['celebrity', 'friend', 'brand'], new Set(['celebrity', 'brand']))).toEqual(['friend']);
  });
});

describe('manual celebrity categorization', () => {
  it('moves marked accounts into a separate group', () => {
    expect(partitionAccounts(['friend', 'celebrity', 'brand'], new Set(['celebrity']))).toEqual({
      regular: ['friend', 'brand'],
      celebrity: ['celebrity'],
    });
  });

  it('labels manually marked accounts separately in the CSV', () => {
    const csv = createResultsCsv(['friend', 'celebrity'], new Set(['celebrity']));
    expect(csv).toContain('"friend","https://instagram.com/friend/","Not following back"');
    expect(csv).toContain('"celebrity","https://instagram.com/celebrity/","Celebrity or verified (manually marked)"');
  });
});

describe('parseInstagramZip', () => {
  it('parses a valid official-style export', async () => {
    const zip = new JSZip();
    zip.file('connections/followers_and_following/followers_1.json', JSON.stringify([follower('alice')]));
    zip.file('connections/followers_and_following/following.json', JSON.stringify({
      relationships_following: [following('alice'), following('bob')],
    }));
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    Object.defineProperties(bytes, {
      name: { value: 'instagram-export.zip' },
      size: { value: bytes.byteLength },
    });

    const result = await parseInstagramZip(bytes);
    expect(result.nonFollowers).toEqual(['bob']);
  });

  it('rejects archives without the required files', async () => {
    const zip = new JSZip();
    zip.file('unrelated.json', '{}');
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    Object.defineProperties(bytes, {
      name: { value: 'instagram-export.zip' },
      size: { value: bytes.byteLength },
    });

    await expect(parseInstagramZip(bytes)).rejects.toThrow(/does not contain/i);
  });
});

describe('parseInstagramJsonFiles', () => {
  it('accepts following and follower JSON files directly', async () => {
    const files = [
      { name: 'following.json', size: 100, text: async () => JSON.stringify({ relationships_following: [following('alice'), following('bob')] }) },
      { name: 'followers_1.json', size: 100, text: async () => JSON.stringify([follower('alice')]) },
    ];
    const result = await parseInstagramJsonFiles(files);
    expect(result.nonFollowers).toEqual(['bob']);
  });

  it('explains which direct JSON files are required', async () => {
    await expect(parseInstagramJsonFiles([
      { name: 'followers_1.json', size: 10, text: async () => '[]' },
    ])).rejects.toThrow(/following\.json/i);
  });
});
