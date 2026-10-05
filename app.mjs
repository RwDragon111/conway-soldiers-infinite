import { Game } from './game.mjs';

const game = new Game();
const $ = id => document.getElementById(id);
const canvas = $('board');
const ctx = canvas.getContext('2d');
const camera = { x: 0.5, y: 1, scale: 44 };
let width = 0, height = 0, selected = null, hover = null, editing = false;
let keyboardCell = { x: 0, y: 1 }, keyboardVisible = false;
let drawPending = false;
const pointers = new Map();
let drag = null, pinch = null;

function screenToWorld(x, y) {
  return { x: (x - width / 2) / camera.scale + camera.x, y: (y - height / 2) / camera.scale + camera.y };
}
function worldToScreen(x, y) {
  return { x: (x - camera.x) * camera.scale + width / 2, y: (y - camera.y) * camera.scale + height / 2 };
}
function localPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}
function cellAt(point) {
  const world = screenToWorld(point.x, point.y);
  return { x: Math.floor(world.x), y: Math.floor(world.y) };
}
function same(a, b) { return a && b && a.x === b.x && a.y === b.y; }
function requestDraw() {
  if (!drawPending) {
    drawPending = true;
    requestAnimationFrame(() => { drawPending = false; draw(); });
  }
}
function message(text, error = false) {
  $('status').textContent = text;
  $('status').classList.toggle('error', error);
}
function update() {
  $('moves').textContent = game.moves;
  $('height').textContent = game.progress;
  $('soldiers').textContent = game.soldierCount === Infinity ? '∞' : game.soldierCount;
  $('soldiers').setAttribute('aria-label', game.soldierCount === Infinity ? 'Бесконечно много солдат' : `${game.soldierCount} солдат`);
  $('undo').disabled = !game.canUndo;
  $('redo').disabled = !game.canRedo;
  updateCursor(hover || keyboardCell);
  requestDraw();
}
function updateCursor(cell) {
  $('coordinates').textContent = `x: ${cell.x} · y: ${-cell.y}`;
  canvas.setAttribute('aria-label', `Бесконечное поле. Клетка x ${cell.x}, y ${-cell.y}. ${game.has(cell.x, cell.y) ? 'Солдат' : 'Пусто'}. ${editing ? 'Редактор' : 'Игра'}. Стрелки выбирают клетку, Enter выполняет действие.`);
}
function act(cell) {
  keyboardCell = { ...cell };
  if (editing) {
    const occupied = game.has(cell.x, cell.y);
    game.toggle(cell.x, cell.y);
    message(occupied ? 'Солдат убран. Это действие можно отменить.' : 'Солдат добавлен. Это действие можно отменить.');
  } else if (same(selected, cell)) {
    selected = null;
    message('Выделение снято. Выберите другого солдата.');
  } else if (game.has(cell.x, cell.y)) {
    selected = { ...cell };
    const count = game.legalMoves(cell.x, cell.y).length;
    message(count ? 'Нажмите на клетку с кольцом, чтобы сделать ход.' : 'У этого солдата пока нет ходов. Выберите другого.', !count);
  } else if (selected && game.move(selected.x, selected.y, cell.x, cell.y)) {
    selected = null;
    message(`Ход выполнен. Выше стартовой линии: ${game.progress}.`);
  } else {
    message(selected ? 'Нужен прыжок через одного солдата на пустую клетку, без диагоналей.' : 'Сначала выберите синего солдата.', true);
  }
  update();
}

function draw() {
  if (!width || !height) return;
  const s = camera.scale;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#fbfcfd';
  ctx.fillRect(0, 0, width, height);
  const start = screenToWorld(0, 0), end = screenToWorld(width, height);
  const left = Math.floor(start.x), right = Math.ceil(end.x);
  const top = Math.floor(start.y), bottom = Math.ceil(end.y);

  ctx.strokeStyle = '#dfe6ed';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = left; x <= right; x++) {
    const px = worldToScreen(x, 0).x;
    ctx.moveTo(px, 0); ctx.lineTo(px, height);
  }
  for (let y = top; y <= bottom; y++) {
    const py = worldToScreen(0, y).y;
    ctx.moveTo(0, py); ctx.lineTo(width, py);
  }
  ctx.stroke();

  if (hover && !drag?.moved && !pinch) {
    const p = worldToScreen(hover.x, hover.y);
    ctx.fillStyle = editing ? '#2c63981a' : '#25344008';
    ctx.fillRect(p.x, p.y, s, s);
  }
  const targets = selected ? game.legalMoves(selected.x, selected.y) : [];
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      if (!game.has(x, y)) continue;
      const p = worldToScreen(x + 0.5, y + 0.5);
      const active = selected?.x === x && selected?.y === y;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s * .31, 0, Math.PI * 2);
      ctx.fillStyle = active ? '#c75a5a' : '#70a1d7';
      ctx.fill();
      ctx.strokeStyle = active ? '#953a3a' : '#5983ad';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (active) {
        ctx.strokeStyle = '#953a3a'; ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(p.x - s * .44, p.y - s * .44, s * .88, s * .88);
        ctx.setLineDash([]);
      }
    }
  }
  for (const cell of targets) {
    const p = worldToScreen(cell.x + .5, cell.y + .5);
    ctx.strokeStyle = '#2c6398'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, s * .28, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#2c6398';
    ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
  }
  if ($('show-line').checked) {
    const py = worldToScreen(0, game.line).y;
    if (py >= 0 && py <= height) {
      ctx.strokeStyle = '#c75a5a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(width, py); ctx.stroke();
      ctx.font = '11px "Segoe UI", sans-serif';
      const label = 'СТАРТ';
      const labelWidth = ctx.measureText(label).width + 12;
      ctx.fillStyle = '#fbfcfd'; ctx.fillRect(width - labelWidth - 12, py - 21, labelWidth, 18);
      ctx.fillStyle = '#a33f3f'; ctx.fillText(label, width - labelWidth - 6, py - 8);
    }
  }
  if (keyboardVisible) {
    const p = worldToScreen(keyboardCell.x, keyboardCell.y);
    ctx.strokeStyle = '#253440'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.strokeRect(p.x + 4, p.y + 4, s - 8, s - 8);
    ctx.setLineDash([]);
  }

  // Draw only the visible cells; the army is implicit outside the viewport.
  ctx.fillStyle = '#f4f7f9';
  ctx.fillRect(0, 0, width, 24); ctx.fillRect(0, 0, 28, height);
  ctx.font = '10px Consolas, monospace'; ctx.fillStyle = '#596a78';
  ctx.textAlign = 'center';
  const labelStep = s < 24 ? 5 : s < 40 ? 2 : 1;
  for (let x = left; x < right; x++) {
    const px = worldToScreen(x + .5, 0).x;
    if (x % labelStep === 0 && px > 38 && px < width - 100) ctx.fillText(x, px, 16);
  }
  for (let y = top; y < bottom; y++) {
    const py = worldToScreen(0, y + .5).y;
    if (y % labelStep === 0 && py > 34 && py < height - 8) ctx.fillText(-y, 14, py + 3);
  }
  ctx.textAlign = 'start';
  $('zoom-value').textContent = `${Math.round(s / 44 * 100)}%`;
  $('zoom-out').disabled = s <= 14;
  $('zoom-in').disabled = s >= 100;
}
function centerView() {
  camera.x = .5;
  camera.y = game.line + height * .08 / camera.scale;
  hover = null;
  keyboardCell = { x: 0, y: game.line + 1 };
  updateCursor(keyboardCell);
  requestDraw();
}
function zoom(factor, point = { x: width / 2, y: height / 2 }) {
  const before = screenToWorld(point.x, point.y);
  camera.scale = Math.max(14, Math.min(100, camera.scale * factor));
  const after = screenToWorld(point.x, point.y);
  camera.x += before.x - after.x;
  camera.y += before.y - after.y;
  requestDraw();
}
function resize() {
  const first = !width;
  const bounds = canvas.getBoundingClientRect();
  width = bounds.width; height = bounds.height;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (first) centerView();
  requestDraw();
}
new ResizeObserver(resize).observe(canvas);

function setMode(edit) {
  editing = edit;
  selected = null;
  $('play-mode').setAttribute('aria-pressed', !edit);
  $('edit-mode').setAttribute('aria-pressed', edit);
  message(edit ? 'Щёлкните по клетке, чтобы добавить или убрать солдата.' : 'Выберите солдата, чтобы увидеть доступные ходы.');
  update();
}
$('play-mode').addEventListener('click', () => setMode(false));
$('edit-mode').addEventListener('click', () => setMode(true));
$('show-line').addEventListener('change', requestDraw);
$('zoom-in').addEventListener('click', () => zoom(1.2));
$('zoom-out').addEventListener('click', () => zoom(1 / 1.2));
$('center').addEventListener('click', centerView);
function historyAction(redo) {
  const changed = redo ? game.redo() : game.undo();
  if (changed) { selected = null; message(redo ? 'Действие повторено.' : 'Действие отменено.'); update(); }
}
$('undo').addEventListener('click', () => historyAction(false));
$('redo').addEventListener('click', () => historyAction(true));
$('reset').addEventListener('click', () => {
  game.reset(); selected = null; camera.scale = 44; centerView();
  message('Начальная расстановка восстановлена. Нижняя половина поля снова заполнена.'); update();
});
$('clear').addEventListener('click', () => {
  game.clear(); selected = null; setMode(true);
  message('Поле пустое. Добавьте солдат в редакторе или отмените очистку.'); update();
});
$('update-line').addEventListener('click', () => {
  if (game.soldierCount === 0) { message('Сначала добавьте хотя бы одного солдата.', true); return; }
  game.updateLine(); selected = null; message('Стартовая линия установлена по верхнему ряду солдат.'); update();
});

canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('pointerdown', event => {
  if (![0, 1, 2].includes(event.button)) return;
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  keyboardVisible = false;
  const point = localPoint(event);
  canvas.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, point);
  if (pointers.size === 1) {
    drag = { start: point, camera: { x: camera.x, y: camera.y }, moved: event.button !== 0, button: event.button };
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    pinch = { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), scale: camera.scale, world: screenToWorld(center.x, center.y) };
    if (drag) drag.moved = true;
  }
  requestDraw();
});
canvas.addEventListener('pointermove', event => {
  const point = localPoint(event);
  if (pointers.has(event.pointerId)) {
    pointers.set(event.pointerId, point);
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      camera.scale = Math.max(14, Math.min(100, pinch.scale * Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance));
      camera.x = pinch.world.x - (center.x - width / 2) / camera.scale;
      camera.y = pinch.world.y - (center.y - height / 2) / camera.scale;
    } else if (drag) {
      const dx = point.x - drag.start.x, dy = point.y - drag.start.y;
      if (Math.hypot(dx, dy) > 5) drag.moved = true;
      if (drag.moved) {
        camera.x = drag.camera.x - dx / camera.scale;
        camera.y = drag.camera.y - dy / camera.scale;
        canvas.classList.add('dragging');
      }
    }
  }
  hover = cellAt(point);
  updateCursor(hover);
  requestDraw();
});
function releasePointer(event, cancelled = false) {
  if (!pointers.has(event.pointerId)) return;
  const click = !cancelled && pointers.size === 1 && !pinch && drag && !drag.moved && drag.button === 0;
  pointers.delete(event.pointerId);
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  if (click) {
    const point = localPoint(event);
    if (point.x > 28 && point.y > 24) act(cellAt(point));
  }
  pinch = null;
  if (pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    pinch = { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), scale: camera.scale, world: screenToWorld(center.x, center.y) };
  } else if (pointers.size === 1) {
    const point = [...pointers.values()][0];
    drag = { start: point, camera: { x: camera.x, y: camera.y }, moved: true, button: 0 };
  } else if (!pointers.size) {
    drag = null; canvas.classList.remove('dragging');
  }
  hover = cellAt(localPoint(event));
  updateCursor(hover);
  requestDraw();
}
canvas.addEventListener('pointerup', event => releasePointer(event));
canvas.addEventListener('pointercancel', event => releasePointer(event, true));
canvas.addEventListener('lostpointercapture', event => releasePointer(event, true));
canvas.addEventListener('pointerleave', () => { if (!pointers.size) { hover = null; requestDraw(); } });
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
  zoom(Math.exp(-Math.max(-300, Math.min(300, delta)) * .0015), localPoint(event));
  hover = cellAt(localPoint(event)); updateCursor(hover);
}, { passive: false });

document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ') {
    event.preventDefault(); historyAction(event.shiftKey); return;
  }
  if ((event.ctrlKey || event.metaKey) && event.code === 'KeyY') {
    event.preventDefault(); historyAction(true); return;
  }
  if (event.key === 'Escape') { selected = null; message('Выделение снято.'); requestDraw(); return; }
  if (document.activeElement !== canvas || event.ctrlKey || event.metaKey || event.altKey) return;
  const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (directions[event.key]) {
    event.preventDefault();
    const [dx, dy] = directions[event.key];
    keyboardCell.x += dx; keyboardCell.y += dy;
    keyboardVisible = true; hover = null;
    const p = worldToScreen(keyboardCell.x + .5, keyboardCell.y + .5);
    if (p.x < 48) camera.x -= (48 - p.x) / camera.scale;
    if (p.x > width - 24) camera.x += (p.x - width + 24) / camera.scale;
    if (p.y < 48) camera.y -= (48 - p.y) / camera.scale;
    if (p.y > height - 24) camera.y += (p.y - height + 24) / camera.scale;
    updateCursor(keyboardCell); requestDraw();
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault(); keyboardVisible = true; act(keyboardCell);
  } else if (event.key === '+' || event.key === '=') {
    event.preventDefault(); zoom(1.2);
  } else if (event.key === '-') {
    event.preventDefault(); zoom(1 / 1.2);
  } else if (event.key === 'Home') {
    event.preventDefault(); centerView();
  }
});
canvas.addEventListener('blur', () => { keyboardVisible = false; requestDraw(); });
update();
