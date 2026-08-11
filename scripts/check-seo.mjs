import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

const pages = [
  ['/', 'index.html'],
  ['/guides/', 'guides/index.html'],
  ['/guides/how-to-see-who-doesnt-follow-you-back-on-instagram/', 'guides/how-to-see-who-doesnt-follow-you-back-on-instagram/index.html'],
  ['/guides/download-instagram-followers-following-data/', 'guides/download-instagram-followers-following-data/index.html'],
  ['/privacy/', 'privacy/index.html'],
  ['/about/', 'about/index.html'],
];

const failures = [];
const titles = new Set();
const descriptions = new Set();
const sitemap = readFileSync('dist/sitemap.xml', 'utf8');

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

function resolveInternalLink(fromFile, href) {
  if (href.startsWith('/')) {
    const path = href.split(/[?#]/)[0];
    if (path === '/') return 'dist/index.html';
    const relative = path.replace(/^\//, '');
    return path.endsWith('/') ? join('dist', relative, 'index.html') : join('dist', relative);
  }
  return normalize(join(dirname(join('dist', fromFile)), href.split(/[?#]/)[0]));
}

for (const [urlPath, file] of pages) {
  const output = join('dist', file);
  if (!existsSync(output)) {
    failures.push(`${urlPath}: missing ${output}`);
    continue;
  }
  const html = readFileSync(output, 'utf8');
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
  const description = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1]?.trim();
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1];
  const expectedCanonical = `https://follow-check.com${urlPath}`;

  if (!title) failures.push(`${urlPath}: missing title`);
  else if (titles.has(title)) failures.push(`${urlPath}: duplicate title: ${title}`);
  else titles.add(title);

  if (!description) failures.push(`${urlPath}: missing meta description`);
  else if (descriptions.has(description)) failures.push(`${urlPath}: duplicate meta description`);
  else descriptions.add(description);

  if (canonical !== expectedCanonical) failures.push(`${urlPath}: canonical should be ${expectedCanonical}`);
  if (countMatches(html, /<h1(?:\s|>)/gi) !== 1) failures.push(`${urlPath}: expected exactly one h1`);
  if (!sitemap.includes(`<loc>${expectedCanonical}</loc>`)) failures.push(`${urlPath}: missing from sitemap`);

  for (const match of html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try { JSON.parse(match[1]); } catch (error) { failures.push(`${urlPath}: invalid JSON-LD (${error.message})`); }
  }

  for (const match of html.matchAll(/href="([^"]+)"/gi)) {
    const href = match[1];
    if (!href || href.startsWith('#') || href.startsWith('http:') || href.startsWith('https:') || href.startsWith('mailto:')) continue;
    const target = resolveInternalLink(file, href);
    if (!existsSync(target)) failures.push(`${urlPath}: broken internal link ${href} -> ${target}`);
  }
}

const robots = readFileSync('dist/robots.txt', 'utf8');
if (!robots.includes('Sitemap: https://follow-check.com/sitemap.xml')) failures.push('robots.txt: sitemap directive missing');

if (failures.length) {
  console.error(`SEO checks failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`SEO checks passed for ${pages.length} indexable pages.`);
