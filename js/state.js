// ── Global App State ──
// All mutable state lives here so every module can read/write it.

let tasks             = [];
let selectedTag       = null;
let selectedDue       = null;
let currentPage       = 1;
let PAGE_SIZE_current = 8;
let currentFilter     = 'all';
let currentView       = 'list';
let dragId            = null;
let selectedRecur     = null;