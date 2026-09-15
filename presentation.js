/**
 * C++ Presentation Deck - Interactive Controller
 */

// Presentation State
let currentSlide = 0;
let totalSlides = 7;
let soundEnabled = true;

// Web Audio API Sound Synthesizer for modern UI clicks
let audioCtx = null;

function playAudioTone(freq, type, duration, gainLevel = 0.05) {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(gainLevel, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.warn('Audio feedback error', e);
  }
}

function playSlideSound() {
  playAudioTone(440, 'sine', 0.12, 0.04);
}

function playCorrectSound() {
  playAudioTone(587.33, 'sine', 0.12, 0.06);
  setTimeout(() => playAudioTone(880, 'sine', 0.22, 0.06), 90);
}

function playWrongSound() {
  playAudioTone(220, 'triangle', 0.2, 0.06);
}

// DOM Elements
const slides = document.querySelectorAll('.slide');
totalSlides = slides.length || 7;
const stepDots = document.querySelectorAll('.step-dot');
const progressBar = document.getElementById('progressBar');
const slideCounter = document.getElementById('slideCounter');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const btnFullscreen = document.getElementById('btnFullscreen');
const btnOverview = document.getElementById('btnOverview');
const btnWhiteboard = document.getElementById('btnWhiteboard');
const btnDockOverview = document.getElementById('btnDockOverview');
const btnMouseMode = document.getElementById('btnMouseMode');
const btnSound = document.getElementById('btnSound');
const soundLabel = document.getElementById('soundLabel');
const overviewModal = document.getElementById('overviewModal');
const btnCloseOverview = document.getElementById('btnCloseOverview');
const heroStartBtn = document.getElementById('heroStartBtn');

// Drawing Tool Elements
const canvas = document.getElementById('drawingCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const btnPen = document.getElementById('btnPen');
const btnEraser = document.getElementById('btnEraser');
const btnClearDraw = document.getElementById('btnClearDraw');
const penColorDot = document.getElementById('penColorDot');
const colorPalettePopup = document.getElementById('colorPalettePopup');

// Persistent slide drawings map (persists until page refresh)
const slideDrawings = {};

// Drawing State
let drawMode = 'none'; // 'none' | 'pen' | 'eraser'
let penColor = '#00f0ff';
let penSize = 4;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

// Setup Canvas Size & Scaling for HiDPI
function setupCanvas() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  restoreSlideDrawing(currentSlide);
}

window.addEventListener('resize', () => {
  setupCanvas();
});

// Save current slide drawings
function saveSlideDrawing(slideIndex) {
  if (!canvas) return;
  try {
    slideDrawings[slideIndex] = canvas.toDataURL();
  } catch (e) {
    console.warn('Canvas save error', e);
  }
}

// Restore slide drawings
function restoreSlideDrawing(slideIndex) {
  if (!canvas || !ctx) return;
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  if (slideDrawings[slideIndex]) {
    const img = new Image();
    img.onload = () => {
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
    };
    img.src = slideDrawings[slideIndex];
  }
}

// Update Slide Display with Persistent Drawings
function goToSlide(index) {
  if (index < 0 || index >= totalSlides) return;

  // Save current slide annotations before moving
  saveSlideDrawing(currentSlide);

  slides.forEach((s, i) => {
    s.classList.remove('active', 'prev-slide');
    if (i < index) {
      s.classList.add('prev-slide');
    } else if (i === index) {
      s.classList.add('active');
    }
  });

  stepDots.forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });

  // Overview thumbnail active indicator
  document.querySelectorAll('.thumb-card').forEach((card, i) => {
    card.classList.toggle('current', i === index);
  });

  // PowerPoint sidebar thumbnail active indicator
  document.querySelectorAll('.pptx-thumb-item').forEach((item) => {
    const slideIdx = parseInt(item.getAttribute('data-slide-index'), 10);
    const isActive = slideIdx === index;
    item.classList.toggle('active', isActive);
    if (isActive && typeof isPptxMode !== 'undefined' && isPptxMode) {
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });

  const pptxSidebarCounter = document.getElementById('pptxSidebarCounter');
  if (pptxSidebarCounter) {
    pptxSidebarCounter.textContent = `${index + 1} / ${totalSlides}`;
  }

  currentSlide = index;

  // Restore drawings on the newly focused slide
  restoreSlideDrawing(currentSlide);

  // Update UI Counters & Progress
  if (slideCounter) {
    slideCounter.textContent = `${index + 1} / ${totalSlides}`;
  }
  if (progressBar) {
    progressBar.style.width = `${((index + 1) / totalSlides) * 100}%`;
  }

  // Update button states
  if (btnPrev) btnPrev.disabled = index === 0;
  if (btnNext) btnNext.disabled = index === totalSlides - 1;

  playSlideSound();
}


function nextSlide() {
  if (currentSlide < totalSlides - 1) {
    goToSlide(currentSlide + 1);
  }
}

function prevSlide() {
  if (currentSlide > 0) {
    goToSlide(currentSlide - 1);
  }
}

// Event Listeners for Nav
if (btnNext) btnNext.addEventListener('click', nextSlide);
if (btnPrev) btnPrev.addEventListener('click', prevSlide);
if (heroStartBtn) heroStartBtn.addEventListener('click', () => goToSlide(1));

stepDots.forEach((dot, index) => {
  dot.addEventListener('click', () => goToSlide(index));
});

// Overview Modal Controls
function toggleOverview(show) {
  if (typeof show === 'boolean') {
    overviewModal.classList.toggle('open', show);
  } else {
    overviewModal.classList.toggle('open');
  }
}

if (btnOverview) btnOverview.addEventListener('click', () => toggleOverview(true));
if (btnDockOverview) btnDockOverview.addEventListener('click', () => toggleOverview(true));
if (btnCloseOverview) btnCloseOverview.addEventListener('click', () => toggleOverview(false));

overviewModal.addEventListener('click', (e) => {
  if (e.target === overviewModal) toggleOverview(false);
});

document.querySelectorAll('.thumb-card').forEach(card => {
  card.addEventListener('click', () => {
    const jumpIndex = parseInt(card.getAttribute('data-jump'), 10);
    goToSlide(jumpIndex);
    toggleOverview(false);
  });
});

// Fullscreen Toggle
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.warn(`Fullscreen error: ${err.message}`);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

if (btnFullscreen) btnFullscreen.addEventListener('click', toggleFullscreen);

// ==========================================================================
// MOUSE NAVIGATION MODE (Left-Click = Next, Right-Click = Prev)
// ==========================================================================
let mouseNavMode = false;

function showToast(msg) {
  let toast = document.getElementById('mouseToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'mouseToast';
    toast.className = 'mouse-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg><span>${msg}</span>`;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
}

function toggleMouseNavMode(forceState) {
  mouseNavMode = (typeof forceState === 'boolean') ? forceState : !mouseNavMode;
  const btn = document.getElementById('btnMouseMode');
  const label = document.getElementById('mouseModeLabel');
  const viewport = document.querySelector('.slides-viewport');

  if (mouseNavMode) {
    if (btn) btn.classList.add('active');
    if (viewport) viewport.classList.add('mouse-nav-active');
    if (label) label.textContent = 'Mouse ON';
    // Disable drawing mode if active to prevent drawing while clicking to navigate
    if (typeof drawMode !== 'undefined' && drawMode) {
      setDrawMode(null);
    }
    showToast('Mouse Mode Active: Left-Click = Next | Right-Click = Prev');
    playAudioTone(660, 'sine', 0.1, 0.04);
  } else {
    if (btn) btn.classList.remove('active');
    if (viewport) viewport.classList.remove('mouse-nav-active');
    if (label) label.textContent = 'Mouse Mode';
    showToast('Mouse Mode Disabled');
    playAudioTone(380, 'sine', 0.1, 0.03);
  }
}

if (btnMouseMode) {
  btnMouseMode.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMouseNavMode();
  });
}

// Left Click Navigation (Next Slide)
document.addEventListener('click', (e) => {
  if (!mouseNavMode) return;
  if (e.button !== 0) return; // Only standard left-click

  // Prevent navigation if clicking inside interactive buttons, inputs, toolbar, docks, whiteboard, or pptx controls
  const isInteractive = e.target.closest(
    'button, a, input, textarea, select, ' +
    '.action-btn, .dock-container, .dock-nav-btn, .pen-palette-modal, ' +
    '.overview-modal, .quiz-option, .btn-reset-quiz, .code-copy-btn, .terminal-dots, .tool-dropdown-wrapper, .floating-whiteboard, .pptx-sidebar, .pptx-thumb-item'
  );
  if (isInteractive) return;

  nextSlide();
});

// Right Click Navigation (Previous Slide)
document.addEventListener('contextmenu', (e) => {
  if (!mouseNavMode) return;

  // Allow standard context menu on form inputs
  const isInput = e.target.closest('input, textarea, select');
  if (isInput) return;

  // Ignore right click on top controls, modals, whiteboard, or pptx sidebar
  const isControlUI = e.target.closest('.action-btn, .pen-palette-modal, .overview-modal, .tool-dropdown-wrapper, .floating-whiteboard, .pptx-sidebar');
  if (isControlUI) return;

  e.preventDefault();
  prevSlide();
});

// Sound toggle
if (btnSound) {
  btnSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundLabel.textContent = soundEnabled ? 'Sound' : 'Muted';
    btnSound.style.opacity = soundEnabled ? '1' : '0.5';
    if (soundEnabled) playSlideSound();
  });
}

// Keyboard Navigation
window.addEventListener('keydown', (e) => {
  // If typing in input or whiteboard textarea, ignore presentation shortcuts
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
    return;
  }

  // If in PowerPoint Mode, Escape key exits PowerPoint mode
  if (typeof isPptxMode !== 'undefined' && isPptxMode && e.key === 'Escape') {
    togglePptxMode(false);
    return;
  }

  // If modal or whiteboard is open, Escape closes it
  if (overviewModal && overviewModal.classList.contains('open')) {
    if (e.key === 'Escape') {
      toggleOverview(false);
      return;
    }
  }

  const wb = document.getElementById('floatingWhiteboard');
  if (wb && wb.classList.contains('show')) {
    if (e.key === 'Escape') {
      toggleWhiteboard(false);
      return;
    }
  }

  if (typeof timerPopup !== 'undefined' && timerPopup && timerPopup.classList.contains('show')) {
    if (e.key === 'Escape') {
      timerPopup.classList.remove('show');
      return;
    }
  }

  switch (e.key) {
    case 'ArrowRight':
    case 'PageDown':
    case ' ':
      e.preventDefault();
      nextSlide();
      break;
    case 'ArrowLeft':
    case 'PageUp':
    case 'Backspace':
      e.preventDefault();
      prevSlide();
      break;
    case 'Home':
      e.preventDefault();
      goToSlide(0);
      break;
    case 'End':
      e.preventDefault();
      goToSlide(totalSlides - 1);
      break;
    case 'f':
    case 'F':
      toggleFullscreen();
      break;
    case 'o':
    case 'O':
      toggleOverview();
      break;
    case 'b':
    case 'B':
      toggleWhiteboard();
      break;
    case 'm':
    case 'M':
      toggleMouseNavMode();
      break;
    case 'p':
    case 'P':
      togglePptxMode();
      break;
    case 't':
    case 'T':
      if (typeof timerPopup !== 'undefined' && timerPopup) {
        timerPopup.classList.toggle('show');
      }
      break;
  }
});

// Code Snippet Copy Helper
function copySnippet(elementId) {
  const container = document.getElementById(elementId);
  if (!container) return;

  const fullCode = (container.innerText || container.textContent || '').trim();
  navigator.clipboard.writeText(fullCode).then(() => {
    const terminalWin = container.closest('.terminal-window') || container.closest('.code-editor-window') || container.closest('.code-example-card');
    if (terminalWin) {
      const copyBtn = terminalWin.querySelector('.copy-code-btn span');
      if (copyBtn) {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
      }
    }
  }).catch(err => console.error('Copy failed:', err));
}


// ==========================================================================
// INTERACTIVE QUIZ ENGINE (SLIDE 6)
// ==========================================================================

const quizQuestions = [
  {
    correctIndex: 1, // Option B: Normal
    explanation: "Correct! Variable speed (75) is NOT > 80, but satisfies `speed >= 60`, triggering the 'Normal' branch."
  },
  {
    correctIndex: 1, // Option B: Failed
    explanation: "Correct! Variable score (40) is less than 50, so the condition is false and the `else` branch executes ('Failed')."
  },
  {
    correctIndex: 0, // Option A: yes
    explanation: "Correct! Since age (18) > 17 is true, the ternary operator `? :` selects the first value 'yes'."
  }
];

let quizAnswers = [null, null, null];

function answerQuestion(qIndex, optIndex) {
  const card = document.querySelector(`.quiz-card[data-q="${qIndex}"]`);
  if (!card) return;

  const qData = quizQuestions[qIndex];
  const isCorrect = (optIndex === qData.correctIndex);
  quizAnswers[qIndex] = isCorrect;

  // Disable all buttons in this card and highlight
  const options = card.querySelectorAll('.quiz-option');
  options.forEach((btn, idx) => {
    btn.disabled = true;
    btn.classList.remove('correct', 'wrong');
    if (idx === qData.correctIndex) {
      btn.classList.add('correct');
    } else if (idx === optIndex && !isCorrect) {
      btn.classList.add('wrong');
    }
  });

  // Display Feedback
  const fb = document.getElementById(`fb-${qIndex}`);
  if (fb) {
    fb.className = `quiz-feedback show ${isCorrect ? 'correct' : 'wrong'}`;
    fb.textContent = isCorrect 
      ? `✔ ${qData.explanation}` 
      : `✖ Incorrect. ${qData.explanation}`;
  }

  // Audio tone
  if (isCorrect) {
    playCorrectSound();
  } else {
    playWrongSound();
  }

  updateQuizScore();
}

function updateQuizScore() {
  const correctCount = quizAnswers.filter(a => a === true).length;
  const scoreCounter = document.getElementById('quizScore');
  if (scoreCounter) {
    scoreCounter.textContent = `Score: ${correctCount} / 3`;
    if (correctCount === 3) {
      scoreCounter.style.color = 'var(--accent-emerald)';
      scoreCounter.textContent = `Score: 3 / 3 (Perfect!)`;
    }
  }
}

function resetQuiz() {
  quizAnswers = [null, null, null];
  document.querySelectorAll('.quiz-card').forEach((card, qIndex) => {
    const options = card.querySelectorAll('.quiz-option');
    options.forEach(btn => {
      btn.disabled = false;
      btn.classList.remove('correct', 'wrong');
    });
    const fb = document.getElementById(`fb-${qIndex}`);
    if (fb) {
      fb.className = 'quiz-feedback';
      fb.textContent = '';
    }
  });

  const scoreCounter = document.getElementById('quizScore');
  if (scoreCounter) {
    scoreCounter.textContent = 'Score: 0 / 3';
    scoreCounter.style.color = 'var(--accent-cyan)';
  }
  playSlideSound();
}

const btnResetQuiz = document.getElementById('btnResetQuiz');
if (btnResetQuiz) {
  btnResetQuiz.addEventListener('click', resetQuiz);
}

// ==========================================================================
// DRAWING ENGINE: PEN, ERASER & COLOR PALETTE
// ==========================================================================

function setDrawMode(mode) {
  drawMode = mode;

  // If drawing tool is activated, disable mouseNavMode to prevent accidental navigation
  if ((mode === 'pen' || mode === 'eraser') && mouseNavMode) {
    toggleMouseNavMode(false);
  }

  // Reset tool button classes
  if (btnPen) btnPen.classList.remove('active');
  if (btnEraser) btnEraser.classList.remove('eraser-active');
  if (canvas) canvas.classList.remove('drawing-pen', 'drawing-eraser');

  if (mode === 'pen') {
    if (btnPen) btnPen.classList.add('active');
    if (canvas) canvas.classList.add('drawing-pen');
    playAudioTone(600, 'sine', 0.08, 0.03);
  } else if (mode === 'eraser') {
    if (btnEraser) btnEraser.classList.add('eraser-active');
    if (canvas) canvas.classList.add('drawing-eraser');
    playAudioTone(350, 'sine', 0.08, 0.03);
  }
}

function toggleColorPalette(show) {
  if (!colorPalettePopup) return;
  if (typeof show === 'boolean') {
    colorPalettePopup.classList.toggle('show', show);
  } else {
    colorPalettePopup.classList.toggle('show');
  }
}

// Pen Button with Click & Long-Press Detection
let penPressTimer = null;
let isLongPressAction = false;

if (btnPen) {
  // Pointer down begins press timer for color selection
  btnPen.addEventListener('pointerdown', (e) => {
    isLongPressAction = false;
    penPressTimer = setTimeout(() => {
      isLongPressAction = true;
      toggleColorPalette(true);
      playAudioTone(520, 'sine', 0.1, 0.04);
    }, 380); // 380ms threshold for long-press
  });

  // Pointer up: if not long-press, toggles pen
  btnPen.addEventListener('pointerup', (e) => {
    clearTimeout(penPressTimer);
    if (!isLongPressAction) {
      if (drawMode === 'pen') {
        setDrawMode('none');
      } else {
        setDrawMode('pen');
      }
    }
  });

  btnPen.addEventListener('pointerleave', () => {
    clearTimeout(penPressTimer);
  });

  // Right-click also opens color palette
  btnPen.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    toggleColorPalette(true);
  });
}

// Color Palette Color Chip Selection
document.querySelectorAll('.color-chip').forEach(chip => {
  chip.addEventListener('click', (e) => {
    e.stopPropagation();
    const color = chip.getAttribute('data-color');
    penColor = color;

    document.querySelectorAll('.color-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    if (penColorDot) {
      penColorDot.style.backgroundColor = color;
      penColorDot.style.boxShadow = `0 0 8px ${color}`;
    }

    setDrawMode('pen');
    toggleColorPalette(false);
  });
});

// Size Chips Selection
document.querySelectorAll('.size-chip').forEach(chip => {
  chip.addEventListener('click', (e) => {
    e.stopPropagation();
    penSize = parseInt(chip.getAttribute('data-size'), 10) || 4;

    document.querySelectorAll('.size-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  });
});

// Close color palette when clicking outside
document.addEventListener('pointerdown', (e) => {
  if (colorPalettePopup && colorPalettePopup.classList.contains('show')) {
    if (!colorPalettePopup.contains(e.target) && !btnPen.contains(e.target)) {
      toggleColorPalette(false);
    }
  }
});

// Eraser Button
if (btnEraser) {
  btnEraser.addEventListener('click', () => {
    if (drawMode === 'eraser') {
      setDrawMode('none');
    } else {
      setDrawMode('eraser');
    }
  });
}

// Clear Canvas Annotations Function
function clearCanvasDrawing() {
  if (!canvas || !ctx) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  delete slideDrawings[currentSlide];
  playAudioTone(280, 'triangle', 0.12, 0.05);

  if (btnClearDraw) {
    btnClearDraw.classList.add('cleared-active');
    setTimeout(() => {
      btnClearDraw.classList.remove('cleared-active');
    }, 250);
  }
}

if (btnClearDraw) {
  btnClearDraw.addEventListener('click', clearCanvasDrawing);
}

// Canvas Drawing Events
if (canvas && ctx) {
  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (drawMode === 'none') return;
    isDrawing = true;
    const coords = getCanvasCoords(e);
    lastX = coords.x;
    lastY = coords.y;

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isDrawing || drawMode === 'none') return;
    const coords = getCanvasCoords(e);

    if (drawMode === 'pen') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    } else if (drawMode === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = penSize * 7;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    lastX = coords.x;
    lastY = coords.y;
  });

  function stopDrawing() {
    if (isDrawing) {
      isDrawing = false;
      saveSlideDrawing(currentSlide);
    }
  }

  canvas.addEventListener('pointerup', stopDrawing);
  canvas.addEventListener('pointerleave', stopDrawing);
}

// Keyboard shortcuts for Pen (D for Draw), Eraser (E), and Clear Screen (C)
window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (e.key === 'd' || e.key === 'D') {
    setDrawMode(drawMode === 'pen' ? 'none' : 'pen');
  } else if (e.key === 'e' || e.key === 'E') {
    setDrawMode(drawMode === 'eraser' ? 'none' : 'eraser');
  } else if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey) {
    clearCanvasDrawing();
  }
});

// Initialize canvas on load & setup slide 0
setTimeout(() => {
  setupCanvas();
}, 80);

// ==========================================================================
// DRAGGABLE WHITEBOARD & NOTES ENGINE
// ==========================================================================
const floatingWhiteboard = document.getElementById('floatingWhiteboard');
const whiteboardHeader = document.getElementById('whiteboardHeader');
const wbCloseBtn = document.getElementById('wbCloseBtn');
const wbTabDraw = document.getElementById('wbTabDraw');
const wbTabNotes = document.getElementById('wbTabNotes');
const wbCanvasPane = document.getElementById('wbCanvasPane');
const wbNotesPane = document.getElementById('wbNotesPane');
const wbCanvas = document.getElementById('whiteboardCanvas');
const wbCtx = wbCanvas ? wbCanvas.getContext('2d') : null;
const wbEraserBtn = document.getElementById('wbEraserBtn');
const wbClearBtn = document.getElementById('wbClearBtn');
const wbNotesArea = document.getElementById('wbNotesArea');
const wbDrawControls = document.getElementById('wbDrawControls');

let wbDrawing = false;
let wbLastX = 0;
let wbLastY = 0;
let wbColor = '#0f172a'; // Default dark marker
let wbLineWidth = 3.5;
let wbIsEraser = false;
let wbCanvasInitialized = false;

function initWhiteboardCanvas() {
  if (!wbCanvas || !wbCanvas.parentElement) return;
  const rect = wbCanvas.parentElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  if (wbCanvas.width !== Math.floor(rect.width) || wbCanvas.height !== Math.floor(rect.height)) {
    // Preserve existing drawing if any
    let tempCanvas = document.createElement('canvas');
    if (wbCanvas.width > 0 && wbCanvas.height > 0) {
      tempCanvas.width = wbCanvas.width;
      tempCanvas.height = wbCanvas.height;
      const tCtx = tempCanvas.getContext('2d');
      if (tCtx) tCtx.drawImage(wbCanvas, 0, 0);
    }

    wbCanvas.width = Math.floor(rect.width);
    wbCanvas.height = Math.floor(rect.height);

    if (!wbCanvasInitialized) {
      wbCtx.fillStyle = '#ffffff';
      wbCtx.fillRect(0, 0, wbCanvas.width, wbCanvas.height);
      wbCanvasInitialized = true;
    } else if (tempCanvas.width > 0 && tempCanvas.height > 0) {
      wbCtx.fillStyle = '#ffffff';
      wbCtx.fillRect(0, 0, wbCanvas.width, wbCanvas.height);
      wbCtx.drawImage(tempCanvas, 0, 0);
    }
  }
}

function toggleWhiteboard(show) {
  if (!floatingWhiteboard) return;
  const isVisible = (typeof show === 'boolean') ? show : !floatingWhiteboard.classList.contains('show');

  floatingWhiteboard.classList.toggle('show', isVisible);
  if (btnWhiteboard) btnWhiteboard.classList.toggle('active', isVisible);

  if (isVisible) {
    playAudioTone(520, 'sine', 0.1, 0.04);
    setTimeout(() => {
      initWhiteboardCanvas();
    }, 60);
  } else {
    playAudioTone(320, 'sine', 0.1, 0.03);
  }
}

if (btnWhiteboard) {
  btnWhiteboard.addEventListener('click', () => {
    toggleWhiteboard();
  });
}

if (wbCloseBtn) {
  wbCloseBtn.addEventListener('click', () => {
    toggleWhiteboard(false);
  });
}

// Draggable Window Handler (Mouse & Touch)
let isDraggingWb = false;
let wbDragStartX = 0;
let wbDragStartY = 0;
let wbInitialLeft = 0;
let wbInitialTop = 0;

if (whiteboardHeader && floatingWhiteboard) {
  whiteboardHeader.addEventListener('mousedown', (e) => {
    // Don't start drag if clicking buttons, tabs, tools inside header
    if (e.target.closest('button, input, textarea, .wb-tabs, .wb-color-btn, .wb-action-tool, .wb-btn-close')) {
      return;
    }
    isDraggingWb = true;
    wbDragStartX = e.clientX;
    wbDragStartY = e.clientY;

    const rect = floatingWhiteboard.getBoundingClientRect();
    wbInitialLeft = rect.left;
    wbInitialTop = rect.top;

    floatingWhiteboard.style.right = 'auto';
    floatingWhiteboard.style.bottom = 'auto';
    floatingWhiteboard.style.left = `${wbInitialLeft}px`;
    floatingWhiteboard.style.top = `${wbInitialTop}px`;
    whiteboardHeader.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDraggingWb) return;
    const dx = e.clientX - wbDragStartX;
    const dy = e.clientY - wbDragStartY;

    let newLeft = wbInitialLeft + dx;
    let newTop = wbInitialTop + dy;

    // Viewport bounds clamp
    const maxLeft = window.innerWidth - floatingWhiteboard.offsetWidth - 10;
    const maxTop = window.innerHeight - floatingWhiteboard.offsetHeight - 10;

    newLeft = Math.max(10, Math.min(newLeft, maxLeft));
    newTop = Math.max(10, Math.min(newTop, maxTop));

    floatingWhiteboard.style.left = `${newLeft}px`;
    floatingWhiteboard.style.top = `${newTop}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isDraggingWb) {
      isDraggingWb = false;
      if (whiteboardHeader) whiteboardHeader.style.cursor = 'grab';
      document.body.style.userSelect = '';
    }
  });
}

// Whiteboard Drawing Canvas Events
function getWbCoordinates(e) {
  const rect = wbCanvas.getBoundingClientRect();
  const scaleX = wbCanvas.width / rect.width;
  const scaleY = wbCanvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function wbStartDrawing(e) {
  if (!wbCanvas || !wbCtx) return;
  wbDrawing = true;
  const pos = getWbCoordinates(e);
  wbLastX = pos.x;
  wbLastY = pos.y;
  wbDrawSegment(pos.x, pos.y, pos.x, pos.y);
}

function wbDrawSegment(x1, y1, x2, y2) {
  if (!wbCtx) return;
  wbCtx.beginPath();
  wbCtx.moveTo(x1, y1);
  wbCtx.lineTo(x2, y2);
  wbCtx.lineCap = 'round';
  wbCtx.lineJoin = 'round';

  if (wbIsEraser) {
    wbCtx.strokeStyle = '#ffffff';
    wbCtx.lineWidth = 26;
  } else {
    wbCtx.strokeStyle = wbColor;
    wbCtx.lineWidth = wbLineWidth;
  }
  wbCtx.stroke();
  wbCtx.closePath();
}

function wbContinueDrawing(e) {
  if (!wbDrawing || !wbCtx) return;
  const pos = getWbCoordinates(e);
  wbDrawSegment(wbLastX, wbLastY, pos.x, pos.y);
  wbLastX = pos.x;
  wbLastY = pos.y;
}

function wbStopDrawing() {
  wbDrawing = false;
}

if (wbCanvas) {
  wbCanvas.addEventListener('pointerdown', wbStartDrawing);
  wbCanvas.addEventListener('pointermove', wbContinueDrawing);
  wbCanvas.addEventListener('pointerup', wbStopDrawing);
  wbCanvas.addEventListener('pointerleave', wbStopDrawing);
  wbCanvas.addEventListener('pointercancel', wbStopDrawing);
}

// Color Markers Selection
document.querySelectorAll('.wb-color-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    wbIsEraser = false;
    if (wbEraserBtn) wbEraserBtn.classList.remove('active');
    document.querySelectorAll('.wb-color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    wbColor = btn.getAttribute('data-color') || '#0f172a';
    playAudioTone(700, 'sine', 0.05, 0.02);
  });
});

// Eraser Tool
if (wbEraserBtn) {
  wbEraserBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    wbIsEraser = !wbIsEraser;
    wbEraserBtn.classList.toggle('active', wbIsEraser);
    if (wbIsEraser) {
      document.querySelectorAll('.wb-color-btn').forEach(b => b.classList.remove('active'));
    } else {
      const activeColorBtn = document.querySelector(`.wb-color-btn[data-color="${wbColor}"]`) || document.querySelector('.wb-color-btn');
      if (activeColorBtn) activeColorBtn.classList.add('active');
    }
    playAudioTone(wbIsEraser ? 360 : 600, 'sine', 0.06, 0.02);
  });
}

// Clear Whiteboard
if (wbClearBtn) {
  wbClearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!wbCanvas || !wbCtx) return;
    wbCtx.fillStyle = '#ffffff';
    wbCtx.fillRect(0, 0, wbCanvas.width, wbCanvas.height);
    playAudioTone(250, 'triangle', 0.15, 0.05);
  });
}

// Tab Switching (Draw vs Notes)
if (wbTabDraw && wbTabNotes) {
  wbTabDraw.addEventListener('click', (e) => {
    e.stopPropagation();
    wbTabDraw.classList.add('active');
    wbTabNotes.classList.remove('active');
    if (wbCanvasPane) wbCanvasPane.classList.add('active');
    if (wbNotesPane) wbNotesPane.classList.remove('active');
    if (wbDrawControls) wbDrawControls.style.display = 'flex';
    setTimeout(initWhiteboardCanvas, 30);
  });

  wbTabNotes.addEventListener('click', (e) => {
    e.stopPropagation();
    wbTabNotes.classList.add('active');
    wbTabDraw.classList.remove('active');
    if (wbNotesPane) wbNotesPane.classList.add('active');
    if (wbCanvasPane) wbCanvasPane.classList.remove('active');
    if (wbDrawControls) wbDrawControls.style.display = 'none';
    if (wbNotesArea) wbNotesArea.focus();
  });
}

// ==========================================================================
// POWERPOINT SCREEN VIEW (P.POINT MODE) ENGINE
// ==========================================================================
const btnPPoint = document.getElementById('btnPPoint');
let isPptxMode = false;

function togglePptxMode(forceState) {
  isPptxMode = (typeof forceState === 'boolean') ? forceState : !isPptxMode;

  const app = document.getElementById('app');
  if (app) {
    app.classList.toggle('pptx-mode', isPptxMode);
  }
  if (btnPPoint) {
    btnPPoint.classList.toggle('active', isPptxMode);
  }

  // Update PowerPoint thumbnails active state to match current presentation slide
  document.querySelectorAll('.pptx-thumb-item').forEach((item) => {
    const slideIdx = parseInt(item.getAttribute('data-slide-index'), 10);
    const isActive = slideIdx === currentSlide;
    item.classList.toggle('active', isActive);
  });

  const pptxSidebarCounter = document.getElementById('pptxSidebarCounter');
  if (pptxSidebarCounter) {
    pptxSidebarCounter.textContent = `${currentSlide + 1} / ${totalSlides}`;
  }

  if (isPptxMode) {
    playAudioTone(640, 'sine', 0.1, 0.04);
    const activeThumb = document.querySelector('.pptx-thumb-item.active');
    if (activeThumb) {
      activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } else {
    playAudioTone(420, 'sine', 0.1, 0.03);
  }

  // Ensure drawing canvas overlays recalculate dimensions correctly
  setTimeout(() => {
    if (typeof resizeCanvas === 'function') resizeCanvas();
  }, 320);
}

if (btnPPoint) {
  btnPPoint.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePptxMode();
  });
}

const pptxCloseBtn = document.getElementById('pptxCloseBtn');
if (pptxCloseBtn) {
  pptxCloseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePptxMode(false);
  });
}

// Click on any PowerPoint sidebar thumbnail jumps directly to that C++ slide
document.querySelectorAll('.pptx-thumb-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    const slideIdx = parseInt(item.getAttribute('data-slide-index'), 10);
    if (!isNaN(slideIdx)) {
      goToSlide(slideIdx);
    }
  });
});

// ==========================================================================
// PRESENTATION COUNTDOWN TIMER ENGINE (PERSISTENT ACROSS RELOADS)
// ==========================================================================
const btnTimer = document.getElementById('btnTimer');
const timerDisplay = document.getElementById('timerDisplay');
const timerPopup = document.getElementById('timerPopup');
const timerStatusBadge = document.getElementById('timerStatusBadge');
const timerBigDisplay = document.getElementById('timerBigDisplay');
const timerHoursEl = document.getElementById('timerHours');
const timerMinutesEl = document.getElementById('timerMinutes');
const timerSecondsEl = document.getElementById('timerSeconds');
const btnTimerStart = document.getElementById('btnTimerStart');
const timerStartLabel = document.getElementById('timerStartLabel');
const btnTimerPause = document.getElementById('btnTimerPause');
const btnTimerReset = document.getElementById('btnTimerReset');
const inputTimerHours = document.getElementById('inputTimerHours');
const inputTimerMinutes = document.getElementById('inputTimerMinutes');
const btnSetCustomTimer = document.getElementById('btnSetCustomTimer');
const timerPresetBtns = document.querySelectorAll('.timer-preset-btn');

const STORAGE_STATUS = 'cpp_deck_timer_status';
const STORAGE_END_TIME = 'cpp_deck_timer_endtime';
const STORAGE_DURATION = 'cpp_deck_timer_duration';
const STORAGE_REMAINING = 'cpp_deck_timer_remaining';

let timerDurationSec = 1800; // default 30 mins
let timerRemainingSec = 1800;
let timerEndTime = 0;
let timerStatus = 'idle'; // 'idle' | 'running' | 'paused' | 'ended'
let timerInterval = null;

function formatDigits(num) {
  return String(num).padStart(2, '0');
}

function updateTimerDisplayUI(totalSec) {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (timerHoursEl) timerHoursEl.textContent = formatDigits(h);
  if (timerMinutesEl) timerMinutesEl.textContent = formatDigits(m);
  if (timerSecondsEl) timerSecondsEl.textContent = formatDigits(s);

  // Top header button label
  if (timerDisplay) {
    if (timerStatus === 'idle') {
      timerDisplay.textContent = 'Timer';
    } else if (timerStatus === 'ended') {
      timerDisplay.textContent = '00:00';
    } else {
      timerDisplay.textContent = h > 0 
        ? `${h}:${formatDigits(m)}:${formatDigits(s)}`
        : `${formatDigits(m)}:${formatDigits(s)}`;
    }
  }

  // Warning styling if <= 120s (2 minutes)
  const isWarning = timerStatus === 'running' && sec <= 120 && sec > 0;
  const isEnded = timerStatus === 'ended' || (timerStatus === 'running' && sec === 0);

  if (btnTimer) {
    btnTimer.classList.toggle('warning', isWarning);
    btnTimer.classList.toggle('ended', isEnded);
    btnTimer.classList.toggle('running', timerStatus === 'running' && !isWarning && !isEnded);
  }

  if (timerBigDisplay) {
    timerBigDisplay.classList.toggle('warning', isWarning);
    timerBigDisplay.classList.toggle('ended', isEnded);
  }
}

function setTimerStatusBadge(status) {
  if (!timerStatusBadge) return;
  timerStatusBadge.className = 'timer-status-badge ' + status;
  if (status === 'running') {
    timerStatusBadge.textContent = 'Running';
  } else if (status === 'paused') {
    timerStatusBadge.textContent = 'Paused';
  } else if (status === 'ended') {
    timerStatusBadge.textContent = "Time's Up!";
  } else {
    timerStatusBadge.textContent = 'Ready';
  }
}

function setTimerDuration(seconds, resetRemaining = true) {
  timerDurationSec = seconds;
  if (resetRemaining) {
    timerRemainingSec = seconds;
  }
  localStorage.setItem(STORAGE_DURATION, timerDurationSec);

  // Update input boxes
  if (inputTimerHours) inputTimerHours.value = Math.floor(seconds / 3600);
  if (inputTimerMinutes) inputTimerMinutes.value = Math.floor((seconds % 3600) / 60);

  // Update preset buttons active state
  timerPresetBtns.forEach(btn => {
    const min = parseInt(btn.getAttribute('data-minutes'), 10);
    btn.classList.toggle('active', min * 60 === seconds);
  });

  updateTimerDisplayUI(timerRemainingSec);
}

function startTimer() {
  if (timerStatus === 'running') return;

  if (timerRemainingSec <= 0) {
    timerRemainingSec = timerDurationSec;
  }

  timerStatus = 'running';
  timerEndTime = Date.now() + timerRemainingSec * 1000;

  localStorage.setItem(STORAGE_STATUS, 'running');
  localStorage.setItem(STORAGE_END_TIME, timerEndTime);
  localStorage.setItem(STORAGE_DURATION, timerDurationSec);

  if (btnTimerStart) {
    btnTimerStart.disabled = true;
    if (timerStartLabel) timerStartLabel.textContent = 'Running';
  }
  if (btnTimerPause) btnTimerPause.disabled = false;

  setTimerStatusBadge('running');
  updateTimerDisplayUI(timerRemainingSec);
  playAudioTone(520, 'sine', 0.1, 0.03);

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const now = Date.now();
    const remaining = Math.max(0, Math.round((timerEndTime - now) / 1000));
    timerRemainingSec = remaining;

    updateTimerDisplayUI(remaining);

    if (remaining <= 0) {
      finishTimer();
    }
  }, 1000);
}

function pauseTimer() {
  if (timerStatus !== 'running') return;

  clearInterval(timerInterval);
  timerStatus = 'paused';
  timerRemainingSec = Math.max(0, Math.round((timerEndTime - Date.now()) / 1000));

  localStorage.setItem(STORAGE_STATUS, 'paused');
  localStorage.setItem(STORAGE_REMAINING, timerRemainingSec);

  if (btnTimerStart) {
    btnTimerStart.disabled = false;
    if (timerStartLabel) timerStartLabel.textContent = 'Resume';
  }
  if (btnTimerPause) btnTimerPause.disabled = true;

  setTimerStatusBadge('paused');
  updateTimerDisplayUI(timerRemainingSec);
  playAudioTone(440, 'triangle', 0.08, 0.03);
}

function resetTimer() {
  clearInterval(timerInterval);
  timerStatus = 'idle';
  timerRemainingSec = timerDurationSec;

  localStorage.setItem(STORAGE_STATUS, 'idle');
  localStorage.setItem(STORAGE_REMAINING, timerRemainingSec);
  localStorage.removeItem(STORAGE_END_TIME);

  if (btnTimerStart) {
    btnTimerStart.disabled = false;
    if (timerStartLabel) timerStartLabel.textContent = 'Start';
  }
  if (btnTimerPause) btnTimerPause.disabled = true;

  setTimerStatusBadge('idle');
  updateTimerDisplayUI(timerRemainingSec);
  playAudioTone(380, 'sine', 0.1, 0.03);
}

function finishTimer() {
  clearInterval(timerInterval);
  timerStatus = 'ended';
  timerRemainingSec = 0;

  localStorage.setItem(STORAGE_STATUS, 'ended');
  localStorage.setItem(STORAGE_REMAINING, 0);

  if (btnTimerStart) {
    btnTimerStart.disabled = false;
    if (timerStartLabel) timerStartLabel.textContent = 'Restart';
  }
  if (btnTimerPause) btnTimerPause.disabled = true;

  setTimerStatusBadge('ended');
  updateTimerDisplayUI(0);

  // Triple audio chime
  playAudioTone(580, 'sine', 0.15, 0.06);
  setTimeout(() => playAudioTone(720, 'sine', 0.18, 0.06), 200);
  setTimeout(() => playAudioTone(880, 'sine', 0.25, 0.07), 420);
}

// Restore state from localStorage on page load (PERSISTENCE)
function restoreTimerState() {
  const savedDuration = parseInt(localStorage.getItem(STORAGE_DURATION), 10);
  if (!isNaN(savedDuration) && savedDuration > 0) {
    timerDurationSec = savedDuration;
  }

  const savedStatus = localStorage.getItem(STORAGE_STATUS);
  const savedEndTime = parseInt(localStorage.getItem(STORAGE_END_TIME), 10);
  const savedRemaining = parseInt(localStorage.getItem(STORAGE_REMAINING), 10);

  setTimerDuration(timerDurationSec, false);

  if (savedStatus === 'running' && !isNaN(savedEndTime)) {
    const remaining = Math.round((savedEndTime - Date.now()) / 1000);
    if (remaining > 0) {
      timerRemainingSec = remaining;
      timerEndTime = savedEndTime;
      timerStatus = 'idle'; // startTimer will set to 'running'
      startTimer(); // automatically resumes without missing a beat!
    } else {
      finishTimer();
    }
  } else if (savedStatus === 'paused' && !isNaN(savedRemaining)) {
    timerRemainingSec = savedRemaining;
    timerStatus = 'paused';
    if (btnTimerStart) {
      btnTimerStart.disabled = false;
      if (timerStartLabel) timerStartLabel.textContent = 'Resume';
    }
    if (btnTimerPause) btnTimerPause.disabled = true;
    setTimerStatusBadge('paused');
    updateTimerDisplayUI(timerRemainingSec);
  } else if (savedStatus === 'ended') {
    finishTimer();
  } else {
    resetTimer();
  }
}

// Event Listeners for Timer
if (btnTimer && timerPopup) {
  btnTimer.addEventListener('click', (e) => {
    e.stopPropagation();
    timerPopup.classList.toggle('show');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#timerDropdownWrapper')) {
      timerPopup.classList.remove('show');
    }
  });

  timerPopup.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

if (btnTimerStart) {
  btnTimerStart.addEventListener('click', (e) => {
    e.stopPropagation();
    startTimer();
  });
}

if (btnTimerPause) {
  btnTimerPause.addEventListener('click', (e) => {
    e.stopPropagation();
    pauseTimer();
  });
}

if (btnTimerReset) {
  btnTimerReset.addEventListener('click', (e) => {
    e.stopPropagation();
    resetTimer();
  });
}

// Presets click listeners
timerPresetBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const minutes = parseInt(btn.getAttribute('data-minutes'), 10);
    if (!isNaN(minutes)) {
      setTimerDuration(minutes * 60, timerStatus !== 'running');
      if (timerStatus === 'running') {
        resetTimer();
        startTimer();
      }
    }
  });
});

// Set custom time button
if (btnSetCustomTimer) {
  btnSetCustomTimer.addEventListener('click', (e) => {
    e.stopPropagation();
    const h = parseInt(inputTimerHours.value || '0', 10);
    const m = parseInt(inputTimerMinutes.value || '0', 10);
    const total = (h * 3600) + (m * 60);
    if (total > 0) {
      setTimerDuration(total, timerStatus !== 'running');
      if (timerStatus === 'running') {
        resetTimer();
        startTimer();
      }
    }
  });
}

// Initialize Timer State from localStorage
restoreTimerState();

// ==========================================================================
// INTERACTIVE IF STATEMENT LIVE RUNNER (SLIDE 7)
// ==========================================================================
function runVotingDemo(age, btn) {
  const valDisplay = document.getElementById('valAgeDisplay');
  const outDisplay = document.getElementById('outVoting');
  const branchIf = document.getElementById('branchVoteIf');
  const branchElse = document.getElementById('branchVoteElse');

  if (valDisplay) valDisplay.textContent = age;

  // Update button active state
  if (btn && btn.parentElement) {
    btn.parentElement.querySelectorAll('.test-input-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  // Branch execution logic & visual highlight
  if (age >= 18) {
    if (branchIf) branchIf.classList.add('active-branch');
    if (branchElse) branchElse.classList.remove('active-branch');
    if (outDisplay) {
      outDisplay.textContent = 'Eligible to vote!';
      outDisplay.style.color = '#34d399';
    }
    playAudioTone(520, 'sine', 0.1, 0.04);
  } else {
    if (branchIf) branchIf.classList.remove('active-branch');
    if (branchElse) branchElse.classList.add('active-branch');
    if (outDisplay) {
      outDisplay.textContent = 'Not old enough yet.';
      outDisplay.style.color = '#fda4af';
    }
    playAudioTone(330, 'sine', 0.1, 0.04);
  }
}

function runGradesDemo(score, btn) {
  const valDisplay = document.getElementById('valScoreDisplay');
  const outDisplay = document.getElementById('outGrades');
  const bA = document.getElementById('branchGradeA');
  const bB = document.getElementById('branchGradeB');
  const bC = document.getElementById('branchGradeC');
  const bF = document.getElementById('branchGradeF');

  if (valDisplay) valDisplay.textContent = score;

  // Update button active state
  if (btn && btn.parentElement) {
    btn.parentElement.querySelectorAll('.test-input-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  [bA, bB, bC, bF].forEach(b => { if (b) b.classList.remove('active-branch'); });

  if (score >= 90) {
    if (bA) bA.classList.add('active-branch');
    if (outDisplay) {
      outDisplay.textContent = 'Grade: Excellent (A)';
      outDisplay.style.color = '#34d399';
    }
  } else if (score >= 75) {
    if (bB) bB.classList.add('active-branch');
    if (outDisplay) {
      outDisplay.textContent = 'Grade: Very Good (B)';
      outDisplay.style.color = '#60a5fa';
    }
  } else if (score >= 50) {
    if (bC) bC.classList.add('active-branch');
    if (outDisplay) {
      outDisplay.textContent = 'Grade: Pass (C)';
      outDisplay.style.color = '#fbbf24';
    }
  } else {
    if (bF) bF.classList.add('active-branch');
    if (outDisplay) {
      outDisplay.textContent = 'Grade: Try Again (F)';
      outDisplay.style.color = '#fda4af';
    }
  }
  playAudioTone(580, 'sine', 0.08, 0.04);
}

// ==========================================================================
// STREAM TAB SWITCHER & DEMOS (COUT & CIN)
// ==========================================================================
let currentStreamTab = 'cout';

function switchStreamTab(tab) {
  currentStreamTab = tab;
  const tabBtnCout = document.getElementById('tabBtnCout');
  const tabBtnCin = document.getElementById('tabBtnCin');
  const cardCout = document.getElementById('cardStreamCout');
  const cardCin = document.getElementById('cardStreamCin');

  const panelCout = document.getElementById('panelCoutDemo');
  const panelCin = document.getElementById('panelCinDemo');
  const runnerCout = document.getElementById('runnerCout');
  const runnerCin = document.getElementById('runnerCin');
  const consoleCout = document.getElementById('consoleCout');
  const consoleCin = document.getElementById('consoleCin');

  if (tab === 'cout') {
    if (tabBtnCout) tabBtnCout.classList.add('active');
    if (tabBtnCin) tabBtnCin.classList.remove('active');
    if (cardCout) cardCout.classList.add('active-stream');
    if (cardCin) cardCin.classList.remove('active-stream');

    if (panelCout) panelCout.style.display = 'block';
    if (panelCin) panelCin.style.display = 'none';
    if (runnerCout) runnerCout.style.display = 'flex';
    if (runnerCin) runnerCin.style.display = 'none';
    if (consoleCout) consoleCout.style.display = 'flex';
    if (consoleCin) consoleCin.style.display = 'none';
  } else {
    if (tabBtnCin) tabBtnCin.classList.add('active');
    if (tabBtnCout) tabBtnCout.classList.remove('active');
    if (cardCin) cardCin.classList.add('active-stream');
    if (cardCout) cardCout.classList.remove('active-stream');

    if (panelCout) panelCout.style.display = 'none';
    if (panelCin) panelCin.style.display = 'block';
    if (runnerCout) runnerCout.style.display = 'none';
    if (runnerCin) runnerCin.style.display = 'flex';
    if (consoleCout) consoleCout.style.display = 'none';
    if (consoleCin) consoleCin.style.display = 'flex';
    promptCinInput();
  }
  playAudioTone(tab === 'cout' ? 600 : 500, 'sine', 0.08, 0.03);
}

function promptCinInput() {
  const outDisplay = document.getElementById('outCinOnly');
  if (!outDisplay) return;

  const currentVal = document.getElementById('cinRunnerInput') ? document.getElementById('cinRunnerInput').value : '20';

  outDisplay.innerHTML = `
    <div class="cin-term-prompt-line">
      <span style="color:#94a3b8">Enter your age: </span>
      <span class="cin-term-inline-wrap">
        <input type="number" id="cinTermInlineInput" class="cin-term-inline-input" value="${currentVal}" placeholder="Type..." min="0" max="999">
        <button class="cin-term-submit-btn" id="btnTermCinSubmit">Enter ↵</button>
      </span>
    </div>
  `;

  const inlineInput = document.getElementById('cinTermInlineInput');
  const inlineBtn = document.getElementById('btnTermCinSubmit');

  if (inlineInput) {
    setTimeout(() => {
      inlineInput.focus();
      inlineInput.select();
    }, 60);

    inlineInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runCinOnlyDemo(inlineInput.value);
      }
    });

    inlineInput.addEventListener('input', () => {
      const runnerInput = document.getElementById('cinRunnerInput');
      if (runnerInput) runnerInput.value = inlineInput.value;
    });
  }

  if (inlineBtn) {
    inlineBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      runCinOnlyDemo(inlineInput ? inlineInput.value : 20);
    });
  }
}

function handleCinRunSubmit() {
  const runnerInput = document.getElementById('cinRunnerInput');
  const val = runnerInput ? runnerInput.value : 20;
  runCinOnlyDemo(val);
}

function runCoutOnlyDemo(score, btn) {
  const codeScore = document.getElementById('valCoutScore');
  const outDisplay = document.getElementById('outCoutOnly');

  if (codeScore) codeScore.textContent = score;

  if (btn && btn.parentElement) {
    btn.parentElement.querySelectorAll('.test-input-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  if (outDisplay) {
    outDisplay.innerHTML = `<span style="color:#34d399">Score: ${score}</span>`;
  }
  playAudioTone(640, 'sine', 0.08, 0.03);
}

function runCinOnlyDemo(age, btn) {
  const cleanAge = (age !== undefined && age !== null && String(age).trim() !== '') ? String(age).trim() : '20';
  const outDisplay = document.getElementById('outCinOnly');
  const runnerInput = document.getElementById('cinRunnerInput');

  if (runnerInput) runnerInput.value = cleanAge;

  // Preset button active state
  if (btn && btn.parentElement) {
    btn.parentElement.querySelectorAll('.test-input-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  } else {
    document.querySelectorAll('#runnerCin .test-input-btn').forEach(b => {
      b.classList.toggle('active', b.textContent.trim() === cleanAge);
    });
  }

  if (outDisplay) {
    outDisplay.innerHTML = `
      <div class="cin-terminal-output-content">
        <div class="cin-term-line"><span style="color:#94a3b8">Enter your age: </span><span style="color:#00f0ff; font-weight:700;">${cleanAge}</span></div>
        <div class="cin-term-line" style="color:#34d399; margin-top:3px;">&gt; Stored in RAM: age = ${cleanAge}</div>
        <div class="cin-term-line" style="color:#38bdf8; margin-top:2px;">&gt; Output: ${cleanAge}</div>
      </div>
      <button class="cin-reenter-btn" onclick="promptCinInput()" title="Click to test another number">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        <span>Type New Number</span>
      </button>
    `;
  }
  playAudioTone(520, 'sine', 0.08, 0.03);
}

function copySnippet(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.innerText || el.textContent;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text);
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  playAudioTone(720, 'sine', 0.08, 0.03);
}

function copyCurrentStreamCode() {
  if (currentStreamTab === 'cout') {
    copySnippet('panelCoutDemo');
  } else {
    copySnippet('panelCinDemo');
  }
}

function runVarsDemo() {
  const outDisplay = document.getElementById('outVarsResult');
  const btn = document.getElementById('btnRunVarsCode');

  if (btn) {
    btn.style.transform = 'scale(0.96)';
    setTimeout(() => { btn.style.transform = ''; }, 120);
  }

  if (outDisplay) {
    outDisplay.innerHTML = '<span style="color:#94a3b8; font-style:italic;">Executing cout...</span>';
    setTimeout(() => {
      outDisplay.innerHTML = '<span style="color:#34d399; font-weight:700;">Ahmed</span>';
      playAudioTone(640, 'sine', 0.1, 0.04);
    }, 150);
  }
}

// ==========================================================================
// VARIABLE MEMORY BOX INTERACTION (int x = value)
// ==========================================================================
let currentBoxValue = 18;
let isBoxValueStored = false;

function selectBoxValue(val, btn) {
  currentBoxValue = val;
  
  // Update button active state
  if (btn && btn.parentElement) {
    btn.parentElement.querySelectorAll('.var-val-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  // Update declaration code preview
  const declCode = document.getElementById('declCodeVal');
  if (declCode) declCode.textContent = val;

  // Update flying capsule
  const flyingNum = document.getElementById('flyingValNum');
  if (flyingNum) flyingNum.textContent = val;

  // If already stored, reset to allow re-animating
  if (isBoxValueStored) {
    resetBoxValue(false);
  }

  playAudioTone(460, 'sine', 0.06, 0.02);
}

function animateStoreValueInBox() {
  const btn = document.getElementById('btnStoreVal');
  const capsule = document.getElementById('flyingValCapsule');
  const boxContainer = document.getElementById('memBoxContainer');
  const interior = document.getElementById('boxInterior');
  const emptyPrompt = document.getElementById('boxEmptyPrompt');
  const storedVal = document.getElementById('boxStoredVal');
  const storedNum = document.getElementById('boxStoredNum');
  const statusText = document.getElementById('boxStatusText');

  if (btn) {
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => { btn.style.transform = ''; }, 120);
  }

  // If already stored, reset first then animate
  if (isBoxValueStored) {
    resetBoxValue(false);
  }

  // Play launch tone
  playAudioTone(440, 'triangle', 0.12, 0.04);

  // Trigger drop transition on the floating capsule
  if (capsule) {
    capsule.classList.add('dropping');
  }

  if (statusText) {
    statusText.innerHTML = `<span style="color:#00f0ff; font-style:italic;">Storing integer ${currentBoxValue} into memory container x...</span>`;
  }

  // After landing transition (450ms)
  setTimeout(() => {
    isBoxValueStored = true;

    // Show landing glow shockwave
    if (boxContainer) {
      boxContainer.classList.add('box-landing-glow');
      setTimeout(() => boxContainer.classList.remove('box-landing-glow'), 600);
    }

    if (interior) {
      interior.classList.add('active-holding');
    }

    if (emptyPrompt) emptyPrompt.style.display = 'none';
    if (storedVal) {
      storedVal.style.display = 'flex';
      if (storedNum) storedNum.textContent = currentBoxValue;
    }

    // Success landing chime (two tones for cyber feel)
    playAudioTone(660, 'sine', 0.1, 0.04);
    setTimeout(() => playAudioTone(880, 'sine', 0.18, 0.05), 90);

    if (statusText) {
      statusText.innerHTML = `✓ Stored: Variable <strong style="color:#fbbf24;">x</strong> (Type: <code style="color:#00f0ff;">int</code>, 4 Bytes) now holds value <strong style="color:#34d399;">${currentBoxValue}</strong> at RAM address <code>0x7FFE4A</code>.`;
    }
  }, 480);
}

function resetBoxValue(withAudio = true) {
  isBoxValueStored = false;
  const capsule = document.getElementById('flyingValCapsule');
  const interior = document.getElementById('boxInterior');
  const emptyPrompt = document.getElementById('boxEmptyPrompt');
  const storedVal = document.getElementById('boxStoredVal');
  const statusText = document.getElementById('boxStatusText');

  if (capsule) {
    capsule.classList.remove('dropping');
  }

  if (interior) {
    interior.classList.remove('active-holding');
  }

  if (emptyPrompt) emptyPrompt.style.display = 'flex';
  if (storedVal) storedVal.style.display = 'none';

  if (statusText) {
    statusText.innerHTML = `Click <strong>"Put in Box"</strong> to assign the integer value into container <code>x</code>.`;
  }

  if (withAudio) {
    playAudioTone(380, 'sine', 0.08, 0.02);
  }
}

let currentPassFailScore = 85;

function setPassFailScore(score, btn) {
  currentPassFailScore = score;
  const valDisplay = document.getElementById('valPassFailScore');
  if (valDisplay) valDisplay.textContent = score;

  if (btn && btn.parentElement) {
    btn.parentElement.querySelectorAll('.test-input-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  const outDisplay = document.getElementById('outPassFailResult');
  if (outDisplay) {
    outDisplay.innerHTML = '<span style="color:#64748b; font-style:italic;">Click "Run Code" to execute...</span>';
  }
  const branchPass = document.getElementById('branchPass');
  const branchFail = document.getElementById('branchFail');
  if (branchPass) branchPass.classList.remove('active-branch');
  if (branchFail) branchFail.classList.remove('active-branch');

  playAudioTone(480, 'sine', 0.05, 0.02);
}

function runPassFailDemo() {
  const btn = document.getElementById('btnRunPassFailCode');
  const outDisplay = document.getElementById('outPassFailResult');
  const branchPass = document.getElementById('branchPass');
  const branchFail = document.getElementById('branchFail');

  if (btn) {
    btn.style.transform = 'scale(0.96)';
    setTimeout(() => { btn.style.transform = ''; }, 120);
  }

  if (outDisplay) {
    outDisplay.innerHTML = '<span style="color:#94a3b8; font-style:italic;">Evaluating condition (score >= 50)...</span>';
  }

  setTimeout(() => {
    if (currentPassFailScore >= 50) {
      if (branchPass) branchPass.classList.add('active-branch');
      if (branchFail) branchFail.classList.remove('active-branch');
      if (outDisplay) {
        outDisplay.innerHTML = '<span style="color:#34d399; font-weight:700;">Passed!</span>';
      }
      playAudioTone(640, 'sine', 0.12, 0.04);
    } else {
      if (branchFail) branchFail.classList.add('active-branch');
      if (branchPass) branchPass.classList.remove('active-branch');
      if (outDisplay) {
        outDisplay.innerHTML = '<span style="color:#f43f5e; font-weight:700;">Failed!</span>';
      }
      playAudioTone(380, 'sine', 0.15, 0.04);
    }
  }, 150);
}

function runGradesDemo(score, btn) {
  const valDisplay = document.getElementById('valScoreDisplay');
  const outDisplay = document.getElementById('outGrades');
  if (valDisplay) valDisplay.textContent = score;

  if (btn && btn.parentElement) {
    btn.parentElement.querySelectorAll('.test-input-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  const branches = {
    A: document.getElementById('branchGradeA'),
    B: document.getElementById('branchGradeB'),
    C: document.getElementById('branchGradeC'),
    F: document.getElementById('branchGradeF'),
  };

  Object.values(branches).forEach(b => { if (b) b.classList.remove('active-branch'); });

  let text = '';
  let color = '#34d399';
  if (score >= 90) {
    if (branches.A) branches.A.classList.add('active-branch');
    text = 'Grade: Excellent (A)';
    color = '#00f0ff';
  } else if (score >= 75) {
    if (branches.B) branches.B.classList.add('active-branch');
    text = 'Grade: Very Good (B)';
    color = '#34d399';
  } else if (score >= 50) {
    if (branches.C) branches.C.classList.add('active-branch');
    text = 'Grade: Pass (C)';
    color = '#fbbf24';
  } else {
    if (branches.F) branches.F.classList.add('active-branch');
    text = 'Grade: Try Again (F)';
    color = '#f43f5e';
  }

  if (outDisplay) {
    outDisplay.innerHTML = `<span style="color:${color}; font-weight:700;">${text}</span>`;
  }
  playAudioTone(580, 'sine', 0.08, 0.03);
}

// Initial setup
goToSlide(0);

