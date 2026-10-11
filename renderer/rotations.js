// Rotations page: list of rotations and the rotation editor.
const PRESETS = [
  [5, '5 min'],
  [15, '15 min'],
  [30, '30 min'],
  [60, '1 hour'],
  [180, '3 hours'],
  [360, '6 hours'],
  [720, '12 hours'],
  [1440, '1 day'],
];

let draft = null;
let pickSource = 'favorites';
let pickLists = { favorites: [], history: [] };

function minutesText(m) {
  if (m % 1440 === 0) return plural(m / 1440, 'day');
  if (m % 60 === 0) return plural(m / 60, 'hour');
  return plural(m, 'minute');
}

function whenText(schedule) {
  return schedule.type === 'interval' ? `Every ${minutesText(schedule.minutes)}` : `Every day at ${schedule.time}`;
}

function whereText(target) {
  return target === 'all' || target >= displays.length ? 'All monitors' : `Monitor ${target + 1}`;
}

function scheduleText(r) {
  return [whenText(r.schedule), r.order === 'shuffle' ? 'Shuffle' : 'In order', displays.length > 1 ? whereText(r.target) : null]
    .filter(Boolean)
    .join('  /  ');
}

function nextText(r) {
  if (!r.enabled) return 'Paused';
  const mins = Math.max(0, Math.round((r.nextAt - Date.now()) / 60000));
  if (mins < 1) return 'Changing any moment';
  if (mins < 60) return `Next change in ${plural(mins, 'minute')}`;
  if (mins < 24 * 60) return `Next change in ${plural(Math.round(mins / 60), 'hour')}`;
  return `Next change ${new Date(r.nextAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`;
}

function thumbImg(url) {
  const img = el('img');
  img.src = url;
  img.loading = 'lazy';
  return img;
}

function rotationCard(r) {
  const c = el('div', r.enabled ? 'rotCard' : 'rotCard paused');

  const collage = el('div', 'collage');
  for (const i of r.images.slice(0, 4)) collage.appendChild(thumbImg(i.thumb));
  collage.appendChild(el('span', 'count', plural(r.images.length, 'wallpaper')));
  collage.onclick = () => r.images.length && openPreview(r.images[0], r.images);
  c.appendChild(collage);

  const body = el('div', 'rotBody');
  const head = el('div', 'rotHead');
  head.appendChild(el('div', 'title', r.name));
  const sw = el('label', 'switch');
  const box = el('input');
  box.type = 'checkbox';
  box.checked = r.enabled;
  box.onchange = () => window.wallflip.enableRotation(r.id, box.checked);
  sw.append(box, el('span', 'track'), el('span', 'switchText', r.enabled ? 'On' : 'Off'));
  head.appendChild(sw);
  body.appendChild(head);

  body.appendChild(el('div', 'subtle', scheduleText(r)));
  body.appendChild(el('div', r.lastError ? 'state bad' : 'state', r.lastError ? `Problem: ${r.lastError}` : nextText(r)));

  const actions = el('div', 'rotActions');
  actions.append(
    button('btn ghost small', 'Change now', async () => {
      await window.wallflip.changeNow(r.id);
      toast('Wallpaper changed');
    }),
    button('btn ghost small', 'Edit', () =>
      openEditor({ id: r.id, name: r.name, images: [...r.images], target: r.target, schedule: { ...r.schedule }, order: r.order }),
    ),
    button('btn ghost small danger', 'Delete', async () => {
      if (confirm(`Delete "${r.name}"? The wallpapers stay in your history and favorites.`)) await window.wallflip.deleteRotation(r.id);
    }),
  );
  body.appendChild(actions);
  c.appendChild(body);
  return c;
}

async function showRotations() {
  $('rotEditor').hidden = true;
  $('rotList').hidden = false;
  $('background').checked = await window.wallflip.getBackground();
  await renderRotationList();
}

async function renderRotationList() {
  const list = await window.wallflip.rotations();
  const box = $('rotCards');
  box.innerHTML = '';
  for (const r of list) box.appendChild(rotationCard(r));
  $('rotEmpty').hidden = list.length > 0;
  $('newRotation').hidden = list.length === 0;
}

function blankDraft(images = []) {
  return { name: '', images, target: 'all', schedule: { type: 'interval', minutes: 30 }, order: 'shuffle' };
}

async function openEditor(d) {
  draft = d;
  const [favorites, history] = await Promise.all([window.wallflip.favorites(), window.wallflip.history()]);
  pickLists = { favorites, history };
  pickSource = favorites.length ? 'favorites' : 'history';
  $('rotName').value = draft.name;
  showTab('rotations');
  $('rotList').hidden = true;
  $('rotEditor').hidden = false;
  renderEditor();
  if (!draft.name) $('rotName').focus();
}

function renderEditor() {
  renderEditorImages();
  renderEditorTargets();
  renderEditorSchedule();
  for (const b of $('rotOrder').children) b.className = b.dataset.order === draft.order ? 'on' : '';
  renderSummary();
}

function renderSummary() {
  const n = draft.images.length;
  $('rotSummary').textContent = n ? `${plural(n, 'wallpaper')}  /  ${whenText(draft.schedule)}` : '';
}

function renderEditorImages() {
  const box = $('rotImages');
  box.innerHTML = '';
  draft.images.forEach((img, i) => {
    const t = el('div', 'thumbItem');
    t.appendChild(thumbImg(img.thumb));
    const x = button('remove', '', () => {
      draft.images.splice(i, 1);
      renderEditorImages();
      renderSummary();
    });
    x.innerHTML = '<svg viewBox="0 0 24 24" class="icon"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    x.title = 'Remove';
    t.appendChild(x);
    box.appendChild(t);
  });
  $('rotCount').textContent = draft.images.length ? plural(draft.images.length, 'wallpaper') : '';
  $('rotHint').textContent = draft.images.length
    ? 'Tip: open any wallpaper in Discover and use "Add to rotation" to add more.'
    : 'No wallpapers yet. Pick some below, or open any wallpaper in Discover and use "Add to rotation".';
  renderPicker();
}

function renderPicker() {
  const have = new Set(draft.images.map((i) => i.id));
  const seen = new Set();
  const box = $('rotPick');
  box.innerHTML = '';
  for (const w of pickLists[pickSource]) {
    if (have.has(w.id) || seen.has(w.id)) continue;
    seen.add(w.id);
    const t = button('thumbItem pick', '', () => {
      draft.images.push(imageOf(w));
      renderEditorImages();
      renderSummary();
    });
    t.title = 'Add to this rotation';
    t.appendChild(thumbImg(w.thumb));
    box.appendChild(t);
  }
  if (seen.size === 0) box.appendChild(el('p', 'subtle', pickSource === 'favorites' ? 'No more favorites to add.' : 'No more wallpapers in your history.'));
  for (const b of $('rotSource').children) b.className = b.dataset.source === pickSource ? 'on' : '';
  $('rotPickWrap').hidden = pickLists.favorites.length + pickLists.history.length === 0;
}

function renderEditorTargets() {
  $('rotWhere').hidden = displays.length < 2;
  $('whenNum').textContent = displays.length < 2 ? '2' : '3';
  const box = $('rotTargets');
  box.innerHTML = '';
  const options = [...displays.map((d, i) => [i, `Monitor ${i + 1}`]), ['all', 'All monitors']];
  for (const [value, label] of options) {
    box.appendChild(
      button(draft.target === value ? 'on' : '', label, () => {
        draft.target = value;
        renderEditorTargets();
      }),
    );
  }
}

function renderEditorSchedule() {
  const interval = draft.schedule.type === 'interval';
  for (const b of $('rotMode').children) b.className = (b.dataset.mode === 'interval') === interval ? 'on' : '';
  $('rotInterval').hidden = !interval;
  $('rotDaily').hidden = interval;
  if (interval) {
    const m = draft.schedule.minutes;
    const unit = m % 1440 === 0 ? 1440 : m % 60 === 0 ? 60 : 1;
    $('rotAmount').value = m / unit;
    $('rotUnit').value = String(unit);
    const box = $('rotPresets');
    box.innerHTML = '';
    for (const [minutes, label] of PRESETS) {
      box.appendChild(
        button(minutes === m ? 'chip on' : 'chip', label, () => {
          draft.schedule.minutes = minutes;
          renderEditorSchedule();
          renderSummary();
        }),
      );
    }
  } else {
    $('rotTime').value = draft.schedule.time;
  }
}

function readCustomInterval() {
  const minutes = Math.round(Number($('rotAmount').value) * Number($('rotUnit').value));
  if (minutes >= 1) draft.schedule.minutes = minutes;
  renderEditorSchedule();
  renderSummary();
}

async function saveEditor() {
  draft.name = $('rotName').value;
  if (draft.images.length < 2) return toast('Add at least 2 wallpapers to rotate between', true);
  if (draft.schedule.type === 'daily' && !$('rotTime').value) return toast('Pick a time of day', true);
  await window.wallflip.saveRotation(JSON.parse(JSON.stringify(draft)));
  toast('Rotation saved');
  showRotations();
}

async function renderAddTo(w) {
  const box = $('addTo');
  box.innerHTML = '';
  for (const r of await window.wallflip.rotations()) {
    box.appendChild(
      button('tag', r.name, async () => {
        const added = await window.wallflip.addToRotation(r.id, imageOf(w));
        toast(added ? `Added to ${r.name}` : `Already in ${r.name}`);
      }),
    );
  }
  box.appendChild(
    button('tag new', '+ New rotation', () => {
      closePreview();
      openEditor(blankDraft([imageOf(w)]));
    }),
  );
}

$('newRotation').onclick = () => openEditor(blankDraft());
$('emptyNew').onclick = () => openEditor(blankDraft());
$('rotBack').onclick = showRotations;
$('rotCancel').onclick = showRotations;
$('rotSave').onclick = saveEditor;
$('rotAmount').onchange = readCustomInterval;
$('rotUnit').onchange = readCustomInterval;
$('rotTime').onchange = () => {
  draft.schedule.time = $('rotTime').value;
  renderSummary();
};
$('background').onchange = (e) => window.wallflip.setBackground(e.target.checked);
$('rotMode').onclick = (e) => {
  const mode = e.target.dataset.mode;
  if (!mode) return;
  draft.schedule = mode === 'daily' ? { type: 'daily', time: $('rotTime').value || '08:00' } : { type: 'interval', minutes: 30 };
  renderEditorSchedule();
  renderSummary();
};
$('rotOrder').onclick = (e) => {
  if (!e.target.dataset.order) return;
  draft.order = e.target.dataset.order;
  renderEditor();
};
$('rotSource').onclick = (e) => {
  if (!e.target.dataset.source) return;
  pickSource = e.target.dataset.source;
  renderPicker();
};

window.wallflip.onRotationsChanged(() => {
  if (!$('rotationsView').hidden && !$('rotList').hidden) renderRotationList();
});
setInterval(() => {
  if (!$('rotationsView').hidden && !$('rotList').hidden) renderRotationList();
}, 30000);
