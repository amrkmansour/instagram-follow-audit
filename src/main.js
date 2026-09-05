import JSZip from 'jszip';
import './style.css';
import { captureCheckoutReturn, checkoutRedirectUrl, getPendingCheckout, redeemAudit } from './payments.js';

export const LIMITS = Object.freeze({
  archiveBytes: 50 * 1024 * 1024,
  jsonEntryBytes: 25 * 1024 * 1024,
  selectedBytes: 50 * 1024 * 1024,
  zipEntries: 2_000,
  followerFiles: 50,
});

const LEGACY_EXCLUSION_KEY = 'followcheck-excluded-usernames';
let activeAuditController = null;
let auditGeneration = 0;

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

export function partitionAccounts(users, marked) {
  return {
    regular: users.filter((username) => !marked.has(username)),
    celebrity: users.filter((username) => marked.has(username)),
  };
}

export function createResultsCsv(users, marked) {
  const { regular, celebrity } = partitionAccounts(users, marked);
  const row = (username, category) => [username, `https://instagram.com/${encodeURIComponent(username)}/`, category].map(csvCell).join(',');
  return ['username,profile,category',
    ...regular.map((username) => row(username, 'Not following back')),
    ...celebrity.map((username) => row(username, 'Celebrity or verified (manually marked)')),
  ].join('\r\n') + '\r\n';
}

const app = typeof document !== 'undefined' ? document.querySelector('#app') : null;

if (app) {
  try {
    localStorage.removeItem(LEGACY_EXCLUSION_KEY);
  } catch {
    // The audit works without browser storage; some privacy modes block access to it entirely.
  }
  app.innerHTML = `
    <nav aria-label="Main navigation"><a class="brand" href="#top">Follow<span>Check</span></a><div class="nav-links"><a href="#how-it-works">How it works</a><a href="/guides/">Guides</a><a href="/privacy/">Privacy</a></div><div class="privacy-pill"><i></i> Private by design</div></nav>
    <main id="top">
      <section class="hero" aria-labelledby="page-title">
        <div class="hero-copy">
          <div class="eyebrow"><span aria-hidden="true">✦</span> The private Instagram follow check</div>
          <h1 id="page-title">Find out who’s <em>not following back.</em></h1>
          <p class="hero-lede">Turn your official Instagram export into a clean, searchable list. No password. No sketchy account access. Your file never leaves your device.</p>
          <div class="hero-actions">
            <a class="checkout-button hero-checkout" data-track="checkout_started" href="${escapeHtml(checkoutUrlWithCampaign())}">Find my non-followers <span class="button-price">$2.99</span> <span aria-hidden="true">→</span></a>
            <a class="text-link" href="/guides/download-instagram-followers-following-data/">How do I get my export?</a>
          </div>
          <span class="purchase-note">One-time purchase · No account · No subscription</span>
          <ul class="hero-trust" aria-label="FollowCheck benefits">
            <li>Private, on-device check</li>
            <li>Search every result</li>
            <li>Download as CSV</li>
          </ul>
        </div>
        <div class="result-preview" aria-label="Example FollowCheck result">
          <div class="preview-top"><span>Example result</span><span class="live-dot">Private</span></div>
          <div class="preview-count"><strong>47</strong><span>accounts aren’t<br />following back</span></div>
          <div class="preview-search">⌕&nbsp;&nbsp; Search accounts</div>
          <div class="preview-row"><span class="avatar avatar-one">JD</span><b>@johndoe</b><span>View ↗</span></div>
          <div class="preview-row"><span class="avatar avatar-two">MC</span><b>@miacarter</b><span>View ↗</span></div>
          <div class="preview-row faded"><span class="avatar avatar-three">NK</span><b>@noahkim</b><span>View ↗</span></div>
          <div class="preview-footer"><span>Example data—not a real audit</span><b>Export CSV ↓</b></div>
        </div>
      </section>
      <section class="value-strip" aria-label="What is included">
        <div><span aria-hidden="true">01</span><strong>Official export only</strong><p>We never ask for your Instagram login.</p></div>
        <div><span aria-hidden="true">02</span><strong>Results in your browser</strong><p>Your follower usernames are not sent to us.</p></div>
        <div><span aria-hidden="true">03</span><strong>A list you can use</strong><p>Search, review, and download your results.</p></div>
      </section>
      <section class="instructions" id="how-it-works" aria-labelledby="instructions-title">
        <div class="section-heading"><span aria-hidden="true">01</span><div><h2 id="instructions-title">How it works</h2><p>Get your export, run one private audit, and review the results.</p></div></div>
        <ol class="steps">
          <li><b aria-hidden="true">1</b><h3>Get your Instagram export</h3><p>Use our free guide to request only your Followers and following data in JSON format.</p></li>
          <li><b aria-hidden="true">2</b><h3>Unlock one audit</h3><p>Pay $2.99 once. Checkout is securely handled by Stripe—there is no subscription.</p></li>
          <li><b aria-hidden="true">3</b><h3>Choose your ZIP</h3><p>Drop in the file Instagram sends you. The comparison happens on your device.</p></li>
          <li><b aria-hidden="true">4</b><h3>Clean up your following</h3><p>Search the current non-followers, mark brands or celebrities, and save a CSV.</p></li>
        </ol>
        <aside class="privacy-disclaimer" aria-label="Data privacy">
          <strong>We don’t store your Instagram data.</strong>
          <p>Your export and audit results are processed only in your browser. They are never uploaded or sent to FollowCheck, and they disappear when you close or refresh the page. Payment is handled separately by Stripe.</p>
        </aside>
      </section>
      <section class="payment-section" id="payment-section" aria-labelledby="payment-title">
        <div class="section-heading"><span aria-hidden="true">02</span><div><h2 id="payment-title">Unlock one audit</h2><p>One secure payment. No account or subscription.</p></div></div>
        <div class="payment-card"><div><span class="payment-kicker">ONE-TIME PURCHASE</span><strong>$2.99 <small>USD</small></strong><p>One browser-based audit with searchable results, category tools, and CSV download. Secure checkout by Stripe.</p></div><div class="payment-action"><a id="checkout" class="checkout-button" data-track="checkout_started" href="${escapeHtml(checkoutUrlWithCampaign())}">See my results for $2.99 <span aria-hidden="true">→</span></a><small>Under 18? Ask a parent or guardian before purchasing.</small></div></div>
        <div id="payment-status" class="status" role="status" aria-live="polite" aria-atomic="true"></div>
      </section>
      <section class="faq-section" aria-labelledby="faq-title">
        <div class="section-heading"><span aria-hidden="true">03</span><div><h2 id="faq-title">Questions, answered</h2><p>The important stuff before you pay.</p></div></div>
        <div class="faq-list">
          <details open><summary>Do you need my Instagram password?</summary><p>No. FollowCheck only reads the official export you request directly from Instagram. It never asks for your password or connects to your account.</p></details>
          <details><summary>Does my Instagram file get uploaded?</summary><p>No. Your ZIP, usernames, and results are processed locally in this browser and are not sent to FollowCheck. Stripe separately handles payment information.</p></details>
          <details><summary>Does this show who unfollowed me?</summary><p>It shows the accounts you currently follow that are not in your current followers list. A single export cannot show who unfollowed you in the past or when it happened.</p></details>
          <details><summary>What does one audit include?</summary><p>One comparison of a valid export, plus search, manual sorting for brands or celebrities, and a CSV download. Keep this tab open while requesting your export so your purchase remains available.</p></details>
          <details><summary>Will it work on my phone?</summary><p>Yes. FollowCheck works in modern mobile and desktop browsers. Download the ZIP from Instagram, return to this tab, and select it without unzipping it.</p></details>
        </div>
      </section>
      <section class="upload-section" id="upload-section" aria-labelledby="upload-title" hidden>
        <div class="export-guide" aria-labelledby="export-guide-title">
          <div class="section-heading"><span aria-hidden="true">04</span><div><h2 id="export-guide-title">Request the right Instagram data</h2><p>Follow these settings so your audit has everything it needs.</p></div></div>
          <ol class="export-steps">
            <li>
              <div class="export-step-copy"><span class="step-number">1</span><div><h3>Open Accounts Center</h3><p>Open Instagram’s Accounts Center in your browser to begin your request.</p><a class="primary-link" href="https://accountscenter.instagram.com/info_and_permissions/" target="_blank" rel="noreferrer">Open Accounts Center <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a></div></div>
            </li>
            <li>
              <div class="export-step-copy"><span class="step-number">2</span><div><h3>Choose Export your information</h3><p>Go to <strong>Your information and permissions</strong> → <strong>Export your information</strong>.</p></div></div>
              <figure class="guide-image guide-image-wide"><img src="/instructions/accounts-center-export.png" alt="Accounts Center with Your information and permissions selected and Export your information highlighted" loading="lazy" decoding="async" /><figcaption>Select “Export your information.”</figcaption></figure>
            </li>
            <li>
              <div class="export-step-copy"><span class="step-number">3</span><div><h3>Set up your export</h3><p>Choose <strong>Create export</strong> → <strong>Export to device</strong>, then confirm each setting below.</p></div></div>
              <div class="setting-arrows" aria-label="Required export settings">
                <div><span aria-hidden="true">→</span><p><strong>Customize information</strong> — Select <strong>Clear all</strong> for every section except <strong>Connections</strong>. Under Connections, leave only <strong>Followers and following</strong> checked.</p></div>
                <div><span aria-hidden="true">→</span><p><strong>Date range</strong> — Choose <strong>All time</strong>.</p></div>
                <div><span aria-hidden="true">→</span><p><strong>Format</strong> — Choose <strong>JSON</strong>.</p></div>
                <div><span aria-hidden="true">→</span><p><strong>Media quality</strong> — Keep <strong>Medium quality</strong>.</p></div>
              </div>
              <figure class="guide-image"><img src="/instructions/followers-and-following.png" alt="Connections settings with only Followers and following checked" loading="lazy" decoding="async" /><figcaption>Under Connections, leave only “Followers and following” checked.</figcaption></figure>
              <div class="final-settings-label">Your settings should look like this:</div>
              <figure class="guide-image"><img src="/instructions/final-export-settings.png" alt="Final Instagram export settings showing Followers and following, All time, JSON, and Medium quality" loading="lazy" decoding="async" /><figcaption>Followers and following · All time · JSON · Medium quality</figcaption></figure>
            </li>
            <li>
              <div class="export-step-copy"><span class="step-number">4</span><div><h3>Start the export</h3><p>Review your settings, then select <strong>Start export</strong>. Instagram will notify you when the file is ready.</p></div></div>
            </li>
            <li>
              <div class="export-step-copy"><span class="step-number">5</span><div><h3>Download and upload your file</h3><p>Download the ZIP file Instagram provides, then drop it into the tool below. We’ll process it in your browser and show your results.</p></div></div>
            </li>
          </ol>
        </div>
        <div class="section-heading upload-heading"><span aria-hidden="true">05</span><div><h2 id="upload-title">Upload your Instagram file</h2><p>We’ll compare the two lists right here in your browser.</p></div></div>
        <label class="dropzone" id="dropzone" tabindex="0" role="button" aria-describedby="upload-help">
          <input type="file" id="file" accept=".zip,.json,application/zip,application/json" multiple />
          <span class="upload-icon" aria-hidden="true">↑</span><strong>Drop your Instagram file here</strong><span>or <u>choose files</u> from your device</span><small id="upload-help">ZIP recommended · JSON files also accepted · Maximum 50 MB</small>
        </label>
        <div id="status" class="status" role="status" aria-live="polite" aria-atomic="true"></div>
        <div id="results" class="results-box" tabindex="-1" aria-labelledby="results-title"></div>
      </section>
    </main>
    <div class="mobile-cta"><a class="checkout-button" data-track="checkout_started" href="${escapeHtml(checkoutUrlWithCampaign())}">Find my non-followers · $2.99</a></div>
    <footer><a class="brand" href="#top">Follow<span>Check</span></a><div class="footer-links"><a href="/guides/">Guides</a><a href="/privacy/">Privacy</a><a href="/about/">About</a></div><p>Independent tool. Not affiliated with Instagram or Meta.</p></footer>`;

  const input = document.querySelector('#file');
  const zone = document.querySelector('#dropzone');
  const status = document.querySelector('#status');
  const results = document.querySelector('#results');
  const checkoutButton = document.querySelector('#checkout');
  const mobileCta = document.querySelector('.mobile-cta');
  const paymentStatus = document.querySelector('#payment-status');
  const uploadSection = document.querySelector('#upload-section');

  const revealUpload = (message) => {
    uploadSection.hidden = false;
    mobileCta.hidden = true;
    paymentStatus.innerHTML = `<div class="working"><i></i> ${escapeHtml(message)}</div>`;
    uploadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const returnedCheckout = captureCheckoutReturn();
  const pendingCheckout = returnedCheckout || getPendingCheckout();
  if (pendingCheckout) {
    if (returnedCheckout) window.followCheckTrack?.('checkout_completed');
    revealUpload('Payment received. Choose a valid Instagram export to use this audit.');
    checkoutButton.textContent = 'Payment ready';
    checkoutButton.setAttribute('aria-disabled', 'true');
    checkoutButton.removeAttribute('href');
  } else if (new URLSearchParams(window.location.search).get('checkout') === 'cancelled') {
    paymentStatus.textContent = 'Checkout was canceled. You have not been charged.';
  }

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
    if (file) processFiles(event.dataTransfer.files, { status, results, input, zone });
  });
  zone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });
  input.addEventListener('change', () => input.files?.length && processFiles(input.files, { status, results, input, zone }));
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

export async function parseInstagramJsonFiles(fileList) {
  const files = [...fileList];
  if (!files.length || files.length > LIMITS.followerFiles + 1) throw new Error('Choose the following.json file and all followers_*.json files together.');
  if (files.some((file) => file.size > LIMITS.jsonEntryBytes) || files.reduce((total, file) => total + file.size, 0) > LIMITS.selectedBytes) {
    throw new Error('The selected JSON files are too large to process safely.');
  }
  const followingFile = files.find((file) => /^following\.json$/i.test(file.name));
  const followerFiles = files.filter((file) => /^followers_\d+\.json$/i.test(file.name));
  if (!followingFile || !followerFiles.length) throw new Error('Select following.json and every followers_*.json file at the same time.');

  const followingJson = JSON.parse(await followingFile.text());
  const followerJson = [];
  for (const file of followerFiles) {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed)) throw new Error(`${file.name} has an unexpected format.`);
    followerJson.push(...parsed);
  }
  return compareLists(followerJson, followingJson);
}

async function processFiles(fileList, elements) {
  const { status, results, input, zone } = elements;
  const generation = ++auditGeneration;
  activeAuditController?.abort();
  activeAuditController = null;
  const files = [...fileList];
  results.replaceChildren();
  if (!files.length) return;
  status.innerHTML = `<div class="working"><i></i> Reading ${files.length === 1 ? escapeHtml(files[0].name) : `${files.length} selected files`}…</div>`;
  try {
    const containsZip = files.some((file) => file.name.toLowerCase().endsWith('.zip'));
    if (containsZip && files.length !== 1) throw new Error('Choose either one ZIP or the individual JSON files—not both.');
    const { followers, following, nonFollowers } = containsZip
      ? await parseInstagramZip(files[0])
      : await parseInstagramJsonFiles(files);
    if (generation !== auditGeneration) return;
    status.innerHTML = '<div class="working"><i></i> Verifying payment…</div>';
    await redeemAudit(getPendingCheckout());
    if (generation !== auditGeneration) return;
    const auditController = new AbortController();
    activeAuditController = auditController;
    const listenerOptions = { signal: auditController.signal };
    const excluded = new Set();
    const markedCelebrity = new Set();
    results.innerHTML = `<div class="summary"><div><small>Following</small><strong>${following.size.toLocaleString()}</strong></div><div><small>Followers in file</small><strong>${followers.size.toLocaleString()}</strong></div><div><small>Not following back</small><strong>${nonFollowers.length.toLocaleString()}</strong></div></div>
      <div class="notice"><strong>Before relying on this list:</strong> confirm that you requested an <b>All time</b> export. Instagram does not include a reliable setting in the ZIP that lets this tool verify the selected date range.</div>
      <div class="result-head"><div><h2 id="results-title">Not following you back</h2><p>Mark celebrity or verified accounts to move them into their own section. Verification is not checked automatically.</p></div><div class="result-actions"><button id="download" type="button">Download CSV</button></div></div>
      <div class="filter-bar"><label>Search accounts <input id="account-search" type="search" placeholder="Type a username…" autocomplete="off" /></label><span id="visible-count"></span><button id="restore-exclusions" class="text-button" type="button">Restore excluded accounts</button></div>
      <div class="accounts" id="accounts"></div>
      <section class="celebrity-results" id="celebrity-results" aria-labelledby="celebrity-title" hidden>
        <div class="celebrity-head"><div><h3 id="celebrity-title">Manually marked celebrity or verified accounts</h3><p>FollowCheck has not verified these labels.</p></div><strong id="celebrity-count"></strong></div>
        <div class="accounts" id="celebrity-accounts"></div>
      </section>`;

    const accounts = results.querySelector('#accounts');
    const celebrityAccounts = results.querySelector('#celebrity-accounts');
    const celebritySection = results.querySelector('#celebrity-results');
    const celebrityCount = results.querySelector('#celebrity-count');
    const visibleCount = results.querySelector('#visible-count');
    const restoreButton = results.querySelector('#restore-exclusions');
    const searchInput = results.querySelector('#account-search');
    const accountRow = (username, index, isCelebrity) => `<div class="account-row"><span>${index + 1}</span><a href="https://instagram.com/${encodeURIComponent(username)}/" target="_blank" rel="noreferrer"><b>@${escapeHtml(username)}</b><em>View <span aria-hidden="true">↗</span><span class="sr-only"> in a new tab</span></em></a><div class="account-actions">${isCelebrity
      ? `<button type="button" data-unmark-celebrity="${escapeHtml(username)}" aria-label="Move @${escapeHtml(username)} back to the main results">Move back</button>`
      : `<button type="button" data-mark-celebrity="${escapeHtml(username)}" aria-label="Mark @${escapeHtml(username)} as celebrity or verified">Mark celebrity</button>`}<button type="button" data-exclude="${escapeHtml(username)}" aria-label="Exclude @${escapeHtml(username)} from these results">Exclude</button></div></div>`;
    const renderAccounts = () => {
      const filtered = filterExcluded(nonFollowers, excluded);
      const { regular, celebrity } = partitionAccounts(filtered, markedCelebrity);
      const query = searchInput.value.trim().toLowerCase();
      const visible = query ? regular.filter((username) => username.includes(query)) : regular;
      const visibleCelebrity = query ? celebrity.filter((username) => username.includes(query)) : celebrity;
      const hiddenCount = nonFollowers.length - filtered.length;
      visibleCount.textContent = `${visible.length.toLocaleString()} in main list${visibleCelebrity.length ? ` · ${visibleCelebrity.length.toLocaleString()} marked shown` : ''}${hiddenCount ? ` · ${hiddenCount.toLocaleString()} excluded` : ''}`;
      restoreButton.hidden = hiddenCount === 0;
      accounts.innerHTML = visible.length
        ? visible.map((username, index) => accountRow(username, index, false)).join('')
        : `<p class="empty">${regular.length ? 'No accounts match your search.' : (nonFollowers.length ? 'No accounts remain in the main list.' : 'Everyone in this export follows you back.')}</p>`;
      celebritySection.hidden = celebrity.length === 0;
      celebrityCount.textContent = celebrity.length.toLocaleString();
      celebrityAccounts.innerHTML = visibleCelebrity.length
        ? visibleCelebrity.map((username, index) => accountRow(username, index, true)).join('')
        : '<p class="empty">No marked accounts match your search.</p>';
    };
    const focusAction = (container, dataKey, username) => {
      [...container.querySelectorAll(`[data-${dataKey}]`)].find((candidate) => candidate.dataset[dataKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] === username)?.focus();
    };
    results.addEventListener('click', (event) => {
      const markButton = event.target.closest('[data-mark-celebrity]');
      const unmarkButton = event.target.closest('[data-unmark-celebrity]');
      const button = event.target.closest('[data-exclude]');
      const username = normalizeUsername(markButton?.dataset.markCelebrity || unmarkButton?.dataset.unmarkCelebrity || button?.dataset.exclude);
      if (!username) return;
      if (markButton) {
        markedCelebrity.add(username);
        renderAccounts();
        status.textContent = `Moved @${username} to Celebrity or verified accounts.`;
        focusAction(celebrityAccounts, 'unmark-celebrity', username);
        return;
      }
      if (unmarkButton) {
        markedCelebrity.delete(username);
        renderAccounts();
        status.textContent = `Moved @${username} back to the main results.`;
        focusAction(accounts, 'mark-celebrity', username);
        return;
      }
      excluded.add(username);
      renderAccounts();
      status.textContent = `Excluded @${username} from these results.`;
      searchInput.focus();
    }, listenerOptions);
    restoreButton.addEventListener('click', () => {
      excluded.clear();
      renderAccounts();
      status.textContent = 'Restored all excluded accounts.';
    }, listenerOptions);
    searchInput.addEventListener('input', renderAccounts, listenerOptions);
    results.querySelector('#download')?.addEventListener('click', () => downloadCsv(filterExcluded(nonFollowers, excluded), markedCelebrity), listenerOptions);
    renderAccounts();
    status.textContent = `Finished. Found ${nonFollowers.length.toLocaleString()} accounts that do not follow you back.`;
    window.followCheckTrack?.('audit_completed');
    results.focus({ preventScroll: true });
  } catch (error) {
    if (generation === auditGeneration) {
      activeAuditController?.abort();
      activeAuditController = null;
    }
    showError(status, error instanceof Error ? error.message : 'We could not complete this audit.');
  }
}

function showError(status, message) {
  status.innerHTML = `<div class="error" role="alert"><strong>Couldn’t complete the audit.</strong> ${escapeHtml(message)}</div>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function downloadCsv(users, markedCelebrity) {
  window.followCheckTrack?.('csv_downloaded');
  const blob = new Blob([createResultsCsv(users, markedCelebrity)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'not-following-back.csv';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function checkoutUrlWithCampaign() {
  const url = new URL(checkoutRedirectUrl());
  const campaign = window.followCheckCampaign || {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) {
    if (campaign[key]) url.searchParams.set(key, campaign[key]);
  }
  return url.toString();
}
