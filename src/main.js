import JSZip from 'jszip';
import './style.css';

export const LIMITS = Object.freeze({
  archiveBytes: 50 * 1024 * 1024,
  jsonEntryBytes: 25 * 1024 * 1024,
  selectedBytes: 50 * 1024 * 1024,
  zipEntries: 2_000,
  followerFiles: 50,
});

const EXCLUSION_KEY = 'followcheck-excluded-usernames';

export const normalizeUsername = (value) => {
  const username = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^[a-z0-9._]{1,30}$/.test(username) ? username : null;
};

export function compareLists(followerJson, followingJson) {
  if (!Array.isArray(followerJson) || !Array.isArray(followingJson?.relationships_following)) {
    throw new Error('The follower data has an unexpected format. Create a new JSON export and try again.');
  }

  const followers = new Set(
    followerJson.map((item) => normalizeUsername(item?.string_list_data?.[0]?.value)).filter(Boolean),
  );
  const following = new Set(
    followingJson.relationships_following.map((item) => normalizeUsername(item?.title)).filter(Boolean),
  );
  const nonFollowers = [...following].filter((username) => !followers.has(username)).sort();
  return { followers, following, nonFollowers };
}

export const csvCell = (value) => {
  let safe = String(value).replace(/"/g, '""');
  if (/^[=+\-@]/.test(safe)) safe = `'${safe}`;
  return `"${safe}"`;
};

export const filterExcluded = (users, excluded) => users.filter((username) => !excluded.has(username));

function loadExclusions() {
  try {
    const values = JSON.parse(localStorage.getItem(EXCLUSION_KEY) || '[]');
    return new Set(Array.isArray(values) ? values.map(normalizeUsername).filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

function saveExclusions(excluded) {
  localStorage.setItem(EXCLUSION_KEY, JSON.stringify([...excluded].sort()));
}

const app = typeof document !== 'undefined' ? document.querySelector('#app') : null;

if (app) {
  app.innerHTML = `
    <nav aria-label="Main navigation"><a class="brand" href="#top">Follow<span>Check</span></a><div class="privacy-pill"><i></i> Your file stays on your device</div></nav>
    <main id="top">
      <section class="hero" aria-labelledby="page-title">
        <div class="eyebrow">Instagram follow audit</div>
        <h1 id="page-title">See who doesn't <em>follow you back.</em></h1>
      </section>
      <section class="instructions" aria-labelledby="instructions-title">
        <div class="section-heading"><span aria-hidden="true">01</span><div><h2 id="instructions-title">Get your Instagram file</h2><p>Request the export first. Instagram will notify you when it is ready.</p></div></div>
        <ol class="steps">
          <li><b aria-hidden="true">1</b><h3>Open Accounts Center</h3><p>Instagram → Settings and activity → Accounts Center → Your information and permissions.</p></li>
          <li><b aria-hidden="true">2</b><h3>Create an export</h3><p>Choose <strong>Export your information</strong> → Create export → your Instagram profile → Export to device.</p></li>
          <li class="important"><b aria-hidden="true">3</b><h3>Choose the right options</h3><p>Select <strong>Followers and following</strong>, set date range to <strong>All time</strong>, and format to <strong>JSON</strong>.</p></li>
          <li><b aria-hidden="true">4</b><h3>Download the ZIP</h3><p>Once Instagram notifies you, download the ZIP file. Leave it zipped—it's ready to use below.</p></li>
        </ol>
        <a class="help-link" href="https://www.facebook.com/help/181231772500920" target="_blank" rel="noreferrer">View Meta's official export guide <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>
      </section>
      <section class="upload-section" aria-labelledby="upload-title">
        <div class="section-heading"><span aria-hidden="true">02</span><div><h2 id="upload-title">Drop your export</h2><p>We’ll compare the two lists right here in your browser.</p></div></div>
        <label class="dropzone" id="dropzone" tabindex="0" role="button" aria-describedby="upload-help">
          <input type="file" id="file" accept=".zip,application/zip" />
          <span class="upload-icon" aria-hidden="true">↑</span><strong>Drop your Instagram ZIP here</strong><span>or <u>choose a file</u> from your device</span><small id="upload-help">ZIP only · Maximum 50 MB</small>
        </label>
        <div id="status" class="status" role="status" aria-live="polite" aria-atomic="true"></div>
        <div id="results" class="results-box" tabindex="-1" aria-labelledby="results-title"></div>
      </section>
    </main>
    <footer><a class="brand" href="#top">Follow<span>Check</span></a><p>Independent tool. Not affiliated with Instagram or Meta.</p></footer>`;

  const input = document.querySelector('#file');
  const zone = document.querySelector('#dropzone');
  const status = document.querySelector('#status');
  const results = document.querySelector('#results');

  const stopDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  ['dragenter', 'dragover'].forEach((name) => zone.addEventListener(name, (event) => {
    stopDrag(event);
    zone.classList.add('active');
  }));
  ['dragleave', 'drop'].forEach((name) => zone.addEventListener(name, (event) => {
    stopDrag(event);
    zone.classList.remove('active');
  }));
  zone.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) processZip(file, { status, results });
  });
  zone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });
  input.addEventListener('change', () => input.files?.[0] && processZip(input.files[0], { status, results }));
}

function getUncompressedSize(entry) {
  const size = entry?._data?.uncompressedSize;
  return Number.isFinite(size) ? size : null;
}

export async function parseInstagramZip(file) {
  if (!file?.name?.toLowerCase().endsWith('.zip') || file.size > LIMITS.archiveBytes) {
    throw new Error('Choose an Instagram ZIP file smaller than 50 MB.');
  }

  const zip = await JSZip.loadAsync(file);
  const names = Object.keys(zip.files);
  if (names.length > LIMITS.zipEntries) throw new Error('This ZIP contains too many files to process safely.');

  const followingPath = names.find((name) => /followers_and_following\/following\.json$/i.test(name));
  const followerPaths = names.filter((name) => /followers_and_following\/followers_\d+\.json$/i.test(name));
  if (!followingPath || !followerPaths.length) {
    throw new Error('This ZIP does not contain the Followers and following JSON files. Check steps 2 and 3 above.');
  }
  if (followerPaths.length > LIMITS.followerFiles) throw new Error('This export contains too many follower files to process safely.');

  const selectedPaths = [followingPath, ...followerPaths];
  let totalBytes = 0;
  for (const path of selectedPaths) {
    const size = getUncompressedSize(zip.file(path));
    if (size === null) throw new Error('This ZIP does not expose safe file-size information. Create a new export and try again.');
    if (size > LIMITS.jsonEntryBytes) throw new Error('One of the JSON files is too large to process safely.');
    totalBytes += size;
  }
  if (totalBytes > LIMITS.selectedBytes) throw new Error('The expanded follower data is too large to process safely.');

  const followingJson = JSON.parse(await zip.file(followingPath).async('string'));
  const followerJson = [];
  for (const path of followerPaths) {
    const parsed = JSON.parse(await zip.file(path).async('string'));
    if (!Array.isArray(parsed)) throw new Error('A follower file has an unexpected format.');
    followerJson.push(...parsed);
  }
  return compareLists(followerJson, followingJson);
}

async function processZip(file, elements) {
  const { status, results } = elements;
  results.replaceChildren();
  status.innerHTML = `<div class="working"><i></i> Reading ${escapeHtml(file.name)}…</div>`;
  try {
    const { followers, following, nonFollowers } = await parseInstagramZip(file);
    const excluded = loadExclusions();
    results.innerHTML = `<div class="summary"><div><small>Following</small><strong>${following.size.toLocaleString()}</strong></div><div><small>Followers in file</small><strong>${followers.size.toLocaleString()}</strong></div><div><small>Not following back</small><strong>${nonFollowers.length.toLocaleString()}</strong></div></div>
      <div class="notice"><strong>Before relying on this list:</strong> confirm that you requested an <b>All time</b> export. Instagram does not include a reliable setting in the ZIP that lets this tool verify the selected date range.</div>
      <div class="result-head"><div><h2 id="results-title">Not following you back</h2><p>Based on the lists in this export. Follower counts are not checked.</p></div><button id="download" type="button">Download CSV</button></div>
      <div class="filter-bar"><span id="visible-count"></span><button id="restore-exclusions" class="text-button" type="button">Restore excluded accounts</button></div>
      <div class="accounts" id="accounts"></div>`;

    const accounts = results.querySelector('#accounts');
    const visibleCount = results.querySelector('#visible-count');
    const restoreButton = results.querySelector('#restore-exclusions');
    const renderAccounts = () => {
      const visible = filterExcluded(nonFollowers, excluded);
      const hiddenCount = nonFollowers.length - visible.length;
      visibleCount.textContent = `${visible.length.toLocaleString()} shown${hiddenCount ? ` · ${hiddenCount.toLocaleString()} excluded` : ''}`;
      restoreButton.hidden = hiddenCount === 0;
      accounts.innerHTML = visible.length
        ? visible.map((username, index) => `<div class="account-row"><span>${index + 1}</span><a href="https://instagram.com/${encodeURIComponent(username)}/" target="_blank" rel="noreferrer"><b>@${escapeHtml(username)}</b><em>View <span aria-hidden="true">↗</span><span class="sr-only"> in a new tab</span></em></a><button type="button" data-exclude="${escapeHtml(username)}" aria-label="Exclude @${escapeHtml(username)} from future results">Exclude</button></div>`).join('')
        : `<p class="empty">${nonFollowers.length ? 'All matching accounts are excluded.' : 'Everyone in this export follows you back.'}</p>`;
    };
    accounts.addEventListener('click', (event) => {
      const button = event.target.closest('[data-exclude]');
      if (!button) return;
      const username = normalizeUsername(button.dataset.exclude);
      if (!username) return;
      excluded.add(username);
      saveExclusions(excluded);
      renderAccounts();
      status.textContent = `Excluded @${username}. The preference is stored only in this browser.`;
    });
    restoreButton.addEventListener('click', () => {
      excluded.clear();
      saveExclusions(excluded);
      renderAccounts();
      status.textContent = 'Restored all excluded accounts.';
    });
    results.querySelector('#download')?.addEventListener('click', () => downloadCsv(filterExcluded(nonFollowers, excluded)));
    renderAccounts();
    status.textContent = `Finished. Found ${nonFollowers.length.toLocaleString()} accounts that do not follow you back.`;
    results.focus({ preventScroll: true });
  } catch (error) {
    showError(status, error instanceof Error ? error.message : 'We could not read this ZIP.');
  }
}

function showError(status, message) {
  status.innerHTML = `<div class="error" role="alert"><strong>Couldn’t read that file.</strong> ${escapeHtml(message)}</div>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function downloadCsv(users) {
  const rows = ['username,profile', ...users.map((username) => `${csvCell(username)},${csvCell(`https://instagram.com/${encodeURIComponent(username)}/`)}`)];
  const blob = new Blob([`${rows.join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'not-following-back.csv';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
