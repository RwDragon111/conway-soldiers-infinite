const directions = [[0, -2], [2, 0], [0, 2], [-2, 0]];
const validCell = (x, y) => Number.isSafeInteger(x) && Number.isSafeInteger(y);
const key = (x, y) => `${x},${y}`;

export class Game {
  base = 'army';
  cells = new Set();
  line = 0;
  moves = 0;
  #past = [];
  #future = [];

  has(x, y) {
    if (!validCell(x, y)) return false;
    const occupied = this.base === 'army' && y >= 0;
    return this.cells.has(key(x, y)) ? !occupied : occupied;
  }

  toggle(x, y) {
    if (!validCell(x, y)) return false;
    const before = this.#state();
    this.#toggleKeys([key(x, y)]);
    this.#record({ keys: [key(x, y)], before, after: this.#state() });
    return true;
  }

  legalMoves(x, y) {
    if (!this.has(x, y)) return [];
    return directions
      .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
      .filter(to => this.#canMove(x, y, to.x, to.y));
  }

  move(fromX, fromY, toX, toY) {
    if (!this.#canMove(fromX, fromY, toX, toY)) return false;
    const before = this.#state();
    const keys = [
      key(fromX, fromY),
      key(fromX + (toX - fromX) / 2, fromY + (toY - fromY) / 2),
      key(toX, toY),
    ];
    this.#toggleKeys(keys);
    this.moves++;
    this.#record({ keys, before, after: this.#state() });
    return true;
  }

  reset() {
    return this.#replace('army');
  }

  clear() {
    return this.#replace('empty');
  }

  updateLine() {
    const top = this.#topRow();
    if (!Number.isFinite(top) || top === this.line) return false;
    const before = this.#state();
    this.line = top;
    this.#record({ keys: [], before, after: this.#state() });
    return true;
  }

  undo() {
    const action = this.#past.pop();
    if (!action) return false;
    if (action.keys) this.#toggleKeys(action.keys);
    this.#apply(action.before);
    this.#future.push(action);
    return true;
  }

  redo() {
    const action = this.#future.pop();
    if (!action) return false;
    if (action.keys) this.#toggleKeys(action.keys);
    this.#apply(action.after);
    this.#past.push(action);
    return true;
  }

  get canUndo() {
    return this.#past.length > 0;
  }

  get canRedo() {
    return this.#future.length > 0;
  }

  get progress() {
    return Math.max(0, this.line - this.#topRow());
  }

  get soldierCount() {
    return this.base === 'army' ? Infinity : this.cells.size;
  }

  #canMove(fromX, fromY, toX, toY) {
    if (!validCell(fromX, fromY) || !validCell(toX, toY)) return false;
    const dx = toX - fromX;
    const dy = toY - fromY;
    if (!((Math.abs(dx) === 2 && dy === 0) || (dx === 0 && Math.abs(dy) === 2))) return false;
    return this.has(fromX, fromY)
      && this.has(fromX + dx / 2, fromY + dy / 2)
      && !this.has(toX, toY);
  }

  #topRow() {
    let top = this.base === 'army' ? 0 : Infinity;
    for (const cell of this.cells) {
      const y = Number(cell.slice(cell.indexOf(',') + 1));
      if (this.base === 'empty' || y < 0) top = Math.min(top, y);
    }
    return top;
  }

  #toggleKeys(keys) {
    for (const cell of keys) {
      if (!this.cells.delete(cell)) this.cells.add(cell);
    }
  }

  #state(includeCells = false) {
    const state = { line: this.line, moves: this.moves };
    if (includeCells) Object.assign(state, { base: this.base, cells: new Set(this.cells) });
    return state;
  }

  #apply(state) {
    this.line = state.line;
    this.moves = state.moves;
    if (state.cells) {
      this.base = state.base;
      this.cells = new Set(state.cells);
    }
  }

  #record(action) {
    this.#past.push(action);
    this.#future.length = 0;
  }

  #replace(base) {
    if (this.base === base && !this.cells.size && !this.line && !this.moves) return false;
    const before = this.#state(true);
    this.base = base;
    this.cells = new Set();
    this.line = 0;
    this.moves = 0;
    this.#record({ before, after: this.#state(true) });
    return true;
  }
}
