import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { compareLists, csvCell, normalizeUsername, parseInstagramZip } from './main.js';

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
