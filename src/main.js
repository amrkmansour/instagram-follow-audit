import JSZip from 'jszip';
import './style.css';
import './compact.css';

const app = document.querySelector('#app');
app.innerHTML = `
  <nav><a class="brand" href="#">Follow<span>Check</span></a><div class="privacy-pill"><i></i> Your file stays on your device</div></nav>
  <main>
    <section class="hero">
      <div class="eyebrow">Instagram follow audit</div>
      <h1>See who doesn't <em>follow you back.</em></h1>
    </section>
    <section class="instructions">
      <div class="section-heading"><span>01</span><div><h2>Get your Instagram file</h2><p>It only takes a few taps. Instagram will notify you when it is ready.</p></div></div>
      <div class="steps">
        <article><b>1</b><h3>Open Accounts Center</h3><p>Instagram → Settings and activity → Accounts Center → Your information and permissions.</p></article>
        <article><b>2</b><h3>Create an export</h3><p>Choose <strong>Export your information</strong> → Create export → your Instagram profile → Export to device.</p></article>
        <article class="important"><b>3</b><h3>Choose the right options</h3><p>Select <strong>Followers and following</strong>, set date range to <strong>All time</strong>, and format to <strong>JSON</strong>.</p></article>
        <article><b>4</b><h3>Download the ZIP</h3><p>Once Instagram notifies you, download the ZIP file. Leave it zipped—it's ready to use below.</p></article>
      </div>
      <a class="help-link" href="https://www.facebook.com/help/181231772500920" target="_blank" rel="noreferrer">View Meta's official export guide ↗</a>
    </section>
    <section class="upload-section">
      <div class="section-heading"><span>02</span><div><h2>Drop your export</h2><p>We’ll compare the two lists right here in your browser.</p></div></div>
      <label class="dropzone" id="dropzone">
        <input type="file" id="file" accept=".zip,application/zip">
        <div class="upload-icon">↑</div><h3>Drop your Instagram ZIP here</h3><p>or <u>choose a file</u> from your device</p><small>ZIP only · Maximum 250 MB</small>
      </label>
      <div id="status" aria-live="polite"></div>
      <div id="results" class="results-box"></div>
    </section>
  </main>
  <footer><a class="brand" href="#">Follow<span>Check</span></a><p>Independent tool. Not affiliated with Instagram or Meta.</p></footer>`;

const input = document.querySelector('#file');
const zone = document.querySelector('#dropzone');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
['dragenter','dragover'].forEach(e => zone.addEventListener(e, () => zone.classList.add('active')));
['dragleave','drop'].forEach(e => zone.addEventListener(e, () => zone.classList.remove('active')));
input.addEventListener('change', () => input.files[0] && processZip(input.files[0]));

async function processZip(file) {
  results.innerHTML = '';
  if (!file.name.toLowerCase().endsWith('.zip') || file.size > 250 * 1024 * 1024) return showError('Choose an Instagram ZIP file smaller than 250 MB.');
  status.innerHTML = `<div class="working"><i></i> Reading ${escapeHtml(file.name)}…</div>`;
  try {
    const zip = await JSZip.loadAsync(file);
    const names = Object.keys(zip.files);
    const followingPath = names.find(n => /followers_and_following\/following\.json$/i.test(n));
    const followerPaths = names.filter(n => /followers_and_following\/followers_\d+\.json$/i.test(n));
    if (!followingPath || !followerPaths.length) throw new Error('This ZIP does not contain the Followers and following JSON files. Check steps 2 and 3 above.');
    const followingJson = JSON.parse(await zip.file(followingPath).async('string'));
    const followerJson = (await Promise.all(followerPaths.map(async p => JSON.parse(await zip.file(p).async('string'))))).flat();
    const followers = new Set(followerJson.map(x => x?.string_list_data?.[0]?.value?.toLowerCase()).filter(Boolean));
    const following = (followingJson.relationships_following || []).map(x => x?.title?.toLowerCase()).filter(Boolean);
    const nonFollowers = [...new Set(following.filter(x => !followers.has(x)))].sort();
    const oldest = Math.min(...followerJson.map(x => x?.string_list_data?.[0]?.timestamp || Infinity));
    const ageDays = Number.isFinite(oldest) ? (Date.now()/1000-oldest)/86400 : Infinity;
    status.innerHTML = '';
    results.innerHTML = `<div class="summary"><div><small>Following</small><strong>${following.length.toLocaleString()}</strong></div><div><small>Followers in file</small><strong>${followers.size.toLocaleString()}</strong></div><div><small>Not following back</small><strong>${nonFollowers.length.toLocaleString()}</strong></div></div>
      ${ageDays < 730 ? `<div class="warning"><strong>Your export may not be “All time.”</strong> Its oldest follower record is only ${Math.round(ageDays)} days old. Results could incorrectly include people who follow you.</div>` : ''}
      <div class="result-head"><div><h2>Not following you back</h2><p>Based on the lists in this export.</p></div><button id="download">Download CSV</button></div>
      <div class="accounts">${nonFollowers.length ? nonFollowers.map((u,i)=>`<a href="https://instagram.com/${encodeURIComponent(u)}" target="_blank" rel="noreferrer"><span>${i+1}</span><b>@${escapeHtml(u)}</b><em>View ↗</em></a>`).join('') : '<p class="empty">Everyone in this export follows you back.</p>'}</div>`;
    document.querySelector('#download')?.addEventListener('click', () => downloadCsv(nonFollowers));
  } catch (e) { showError(e.message || 'We could not read this ZIP.'); }
}
function showError(message){ status.innerHTML = `<div class="error"><strong>Couldn’t read that file.</strong> ${escapeHtml(message)}</div>`; }
function escapeHtml(s){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function downloadCsv(users){ const blob=new Blob(['username,profile\n',...users.map(u=>`"${u}","https://instagram.com/${u}"\n`)],{type:'text/csv'}); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='not-following-back.csv';a.click();URL.revokeObjectURL(a.href); }
