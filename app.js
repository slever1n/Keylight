/**
 * LUMINA MONITOR KEYLIGHT — ENGINE & LOGIC
 * High-accuracy Kelvin-to-RGB conversion, auto-wake lock, glassmorphic HUD & multi-mode lighting.
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // STATE MANAGEMENT
  // ---------------------------------------------------------------------------
  const STORAGE_KEY = 'lumina_keylight_state_v1';

  const state = {
    mode: 'kelvin', // 'kelvin', 'split', 'ring', 'rgb'
    isOn: true,
    isPinned: false,
    isFullscreen: false,

    // Kelvin Mode
    kelvin: 5500,
    brightness: 100, // 5 to 100
    tint: 0, // -50 (magenta) to +50 (green)

    // Split Mode
    splitLeftKelvin: 3200,
    splitLeftBrightness: 100,
    splitRightKelvin: 6500,
    splitRightBrightness: 80,
    splitAngle: 90,

    // Ring Mode
    ringSize: 40, // percent
    ringSoftness: 15, // percent

    // RGB Mode
    rgbHue: 280,
    rgbSat: 85,

    // Webcam
    cameraActive: false,
    cameraFlipped: true,
  };

  // Restore saved preferences
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      Object.assign(state, JSON.parse(saved));
      // Always start with light ON & camera OFF for fresh session safety
      state.isOn = true;
      state.cameraActive = false;
    }
  } catch (e) {
    console.warn('Could not load saved keylight settings', e);
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Ignore quota errors
    }
  }

  // ---------------------------------------------------------------------------
  // DOM REFERENCES
  // ---------------------------------------------------------------------------
  const dom = {
    body: document.body,
    lightSurface: document.getElementById('light-surface'),
    ringCutout: document.getElementById('ring-cutout'),
    hudContainer: document.getElementById('hud-container'),
    brandPip: document.getElementById('brand-pip'),

    // Utility actions
    fullscreenBtn: document.getElementById('fullscreen-btn'),
    fsEnterIcon: document.querySelector('.fs-enter-icon'),
    fsExitIcon: document.querySelector('.fs-exit-icon'),
    hudPinBtn: document.getElementById('hud-pin-btn'),
    shortcutsBtn: document.getElementById('shortcuts-btn'),
    shortcutsDialog: document.getElementById('shortcuts-dialog'),
    shortcutsCloseBtn: document.getElementById('shortcuts-close-btn'),
    shortcutsConfirmBtn: document.getElementById('shortcuts-confirm-btn'),
    wakelockPill: document.getElementById('wakelock-pill'),
    wakelockLabel: document.getElementById('wakelock-label'),

    // Mode tabs
    modeTabs: document.querySelectorAll('.mode-tab'),
    tabPanels: document.querySelectorAll('.tab-panel'),

    // Kelvin Panel
    kelvinDisplay: document.getElementById('kelvin-display'),
    kelvinName: document.getElementById('kelvin-name'),
    kelvinChip: document.getElementById('kelvin-chip'),
    kelvinBadge: document.getElementById('kelvin-badge'),
    kelvinSlider: document.getElementById('kelvin-slider'),
    kelvinMinus: document.getElementById('kelvin-minus'),
    kelvinPlus: document.getElementById('kelvin-plus'),
    presetPills: document.querySelectorAll('.preset-pill'),

    // Split Panel
    splitLeftVal: document.getElementById('split-left-val'),
    splitLeftSlider: document.getElementById('split-left-slider'),
    splitLeftBright: document.getElementById('split-left-bright'),
    splitRightVal: document.getElementById('split-right-val'),
    splitRightSlider: document.getElementById('split-right-slider'),
    splitRightBright: document.getElementById('split-right-bright'),
    splitAngleSlider: document.getElementById('split-angle-slider'),
    splitAngleVal: document.getElementById('split-angle-val'),

    // Ring Panel
    ringSizeSlider: document.getElementById('ring-size-slider'),
    ringSizeVal: document.getElementById('ring-size-val'),
    ringSoftnessSlider: document.getElementById('ring-softness-slider'),
    ringSoftnessVal: document.getElementById('ring-softness-val'),

    // RGB Panel
    rgbPreviewBox: document.getElementById('rgb-preview-box'),
    rgbHueSlider: document.getElementById('rgb-hue-slider'),
    rgbHueVal: document.getElementById('rgb-hue-val'),
    rgbSatSlider: document.getElementById('rgb-sat-slider'),
    rgbSatVal: document.getElementById('rgb-sat-val'),
    rgbPresetBtns: document.querySelectorAll('.rgb-preset-btn'),

    // Shared Footer
    brightnessSlider: document.getElementById('brightness-slider'),
    brightnessBadge: document.getElementById('brightness-badge'),
    muteLightBtn: document.getElementById('mute-light-btn'),
    tintSlider: document.getElementById('tint-slider'),
    tintBadge: document.getElementById('tint-badge'),

    // Camera Preview
    cameraToggleBtn: document.getElementById('camera-toggle-btn'),
    cameraPreviewContainer: document.getElementById('camera-preview-container'),
    cameraDragHandle: document.getElementById('camera-drag-handle'),
    cameraVideo: document.getElementById('webcam-video'),
    cameraPlaceholder: document.getElementById('camera-placeholder'),
    camFlipBtn: document.getElementById('cam-flip-btn'),
    camCloseBtn: document.getElementById('cam-close-btn'),
  };

  // ---------------------------------------------------------------------------
  // COLOR SCIENCE: TANNER HELLAND BLACKBODY KELVIN TO RGB
  // ---------------------------------------------------------------------------
  function kelvinToRGB(kelvin) {
    const temp = kelvin / 100;
    let red, green, blue;

    // Red
    if (temp <= 66) {
      red = 255;
    } else {
      red = temp - 60;
      red = 329.698727446 * Math.pow(red, -0.1332047592);
      if (red < 0) red = 0;
      if (red > 255) red = 255;
    }

    // Green
    if (temp <= 66) {
      green = temp;
      green = 99.4708025861 * Math.log(green) - 161.1195681661;
      if (green < 0) green = 0;
      if (green > 255) green = 255;
    } else {
      green = temp - 60;
      green = 288.1221695283 * Math.pow(green, -0.0755148492);
      if (green < 0) green = 0;
      if (green > 255) green = 255;
    }

    // Blue
    if (temp >= 66) {
      blue = 255;
    } else if (temp <= 19) {
      blue = 0;
    } else {
      blue = temp - 10;
      blue = 138.5177312231 * Math.log(blue) - 305.0447927307;
      if (blue < 0) blue = 0;
      if (blue > 255) blue = 255;
    }

    return {
      r: Math.round(red),
      g: Math.round(green),
      b: Math.round(blue),
    };
  }

  // Apply brightness, tint shift, and light status
  function calculateColor(kelvin, brightnessFactor, tintShift) {
    if (!state.isOn) {
      return { r: 0, g: 0, b: 0, hex: '#000000', css: 'rgb(0, 0, 0)' };
    }

    const base = kelvinToRGB(kelvin);
    const brightMult = Math.max(0.01, (state.brightness / 100) * (brightnessFactor || 1));

    let r = base.r;
    let g = base.g;
    let b = base.b;

    // Apply Tint (Green-Magenta Duv correction)
    // Positive tint adds green / subtracts magenta; negative adds magenta
    if (tintShift !== undefined && tintShift !== 0) {
      const tintFactor = tintShift / 100;
      if (tintFactor > 0) {
        g = Math.min(255, g * (1 + tintFactor * 0.35));
        r = Math.max(0, r * (1 - tintFactor * 0.15));
        b = Math.max(0, b * (1 - tintFactor * 0.15));
      } else {
        const absFactor = Math.abs(tintFactor);
        g = Math.max(0, g * (1 - absFactor * 0.3));
        r = Math.min(255, r * (1 + absFactor * 0.15));
        b = Math.min(255, b * (1 + absFactor * 0.2));
      }
    }

    // Apply Brightness
    r = Math.round(Math.min(255, Math.max(0, r * brightMult)));
    g = Math.round(Math.min(255, Math.max(0, g * brightMult)));
    b = Math.round(Math.min(255, Math.max(0, b * brightMult)));

    const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    const css = `rgb(${r}, ${g}, ${b})`;

    return { r, g, b, hex, css };
  }

  // Descriptive Kelvin names
  function getKelvinDescription(k) {
    if (k < 2300) return 'Candlelight (Amber Glow)';
    if (k < 2900) return 'Sunset / Warm Incandescent';
    if (k < 3500) return 'Studio Tungsten / Halogen';
    if (k < 4500) return 'Neutral White / Fluorescent';
    if (k < 5200) return 'Horizon Sunlight';
    if (k < 6200) return 'Direct Daylight (Studio White)';
    if (k < 7200) return 'Cool Broadcast / Clean White';
    if (k < 8500) return 'Overcast Sky / Cool Blue';
    return 'Arctic Deep Cold Blue';
  }

  // ---------------------------------------------------------------------------
  // RENDER / UPDATE ENGINE
  // ---------------------------------------------------------------------------
  function updateLighting() {
    dom.body.className = `mode-${state.mode}`;

    if (!state.isOn) {
      dom.lightSurface.style.background = '#000000';
      dom.brandPip.style.background = '#333333';
      dom.brandPip.style.boxShadow = 'none';
      dom.muteLightBtn.style.opacity = '0.4';
      dom.brightnessBadge.textContent = 'Muted (0%)';
      return;
    }

    dom.muteLightBtn.style.opacity = '1';
    dom.brightnessBadge.textContent = `${state.brightness}%`;

    const masterColor = calculateColor(state.kelvin, 1, state.tint);
    dom.brandPip.style.background = masterColor.hex;
    dom.brandPip.style.boxShadow = `0 0 10px ${masterColor.hex}`;

    if (state.mode === 'kelvin') {
      dom.lightSurface.style.background = masterColor.css;
    } else if (state.mode === 'split') {
      const leftCol = calculateColor(state.splitLeftKelvin, state.splitLeftBrightness / 100, state.tint);
      const rightCol = calculateColor(state.splitRightKelvin, state.splitRightBrightness / 100, state.tint);
      dom.lightSurface.style.background = `linear-gradient(${state.splitAngle}deg, ${leftCol.css} 0%, ${rightCol.css} 100%)`;
    } else if (state.mode === 'ring') {
      dom.lightSurface.style.background = masterColor.css;
      const sizePx = Math.min(window.innerWidth, window.innerHeight) * (state.ringSize / 100);
      dom.ringCutout.style.width = `${sizePx}px`;
      dom.ringCutout.style.height = `${sizePx}px`;
      dom.ringCutout.style.boxShadow = `0 0 ${state.ringSoftness * 4}px rgba(0, 0, 0, 0.95)`;
    } else if (state.mode === 'rgb') {
      const brightMult = state.brightness / 100;
      const lightness = Math.round(50 * brightMult);
      const hslStr = `hsl(${state.rgbHue}, ${state.rgbSat}%, ${lightness}%)`;
      dom.lightSurface.style.background = hslStr;
      dom.rgbPreviewBox.style.backgroundColor = `hsl(${state.rgbHue}, ${state.rgbSat}%, 50%)`;
    }

    // Update Kelvin readouts & indicators
    dom.kelvinDisplay.textContent = state.kelvin;
    dom.kelvinBadge.textContent = `${state.kelvin}K`;
    dom.kelvinName.textContent = getKelvinDescription(state.kelvin);
    dom.kelvinChip.style.background = masterColor.hex;

    // Update Tint readout
    if (state.tint === 0) {
      dom.tintBadge.textContent = 'Neutral (0)';
    } else if (state.tint > 0) {
      dom.tintBadge.textContent = `+${state.tint} Green`;
    } else {
      dom.tintBadge.textContent = `${state.tint} Magenta`;
    }

    // Sync input slider values
    dom.kelvinSlider.value = state.kelvin;
    dom.brightnessSlider.value = state.brightness;
    dom.tintSlider.value = state.tint;

    dom.splitLeftSlider.value = state.splitLeftKelvin;
    dom.splitLeftVal.textContent = `${state.splitLeftKelvin}K`;
    dom.splitLeftBright.value = state.splitLeftBrightness;

    dom.splitRightSlider.value = state.splitRightKelvin;
    dom.splitRightVal.textContent = `${state.splitRightKelvin}K`;
    dom.splitRightBright.value = state.splitRightBrightness;

    dom.splitAngleSlider.value = state.splitAngle;
    dom.splitAngleVal.textContent = `${state.splitAngle}°`;

    dom.ringSizeSlider.value = state.ringSize;
    dom.ringSizeVal.textContent = `${state.ringSize}%`;
    dom.ringSoftnessSlider.value = state.ringSoftness;
    dom.ringSoftnessVal.textContent = `${state.ringSoftness}%`;

    dom.rgbHueSlider.value = state.rgbHue;
    dom.rgbHueVal.textContent = `${state.rgbHue}°`;
    dom.rgbSatSlider.value = state.rgbSat;
    dom.rgbSatVal.textContent = `${state.rgbSat}%`;

    // Sync active preset highlight
    dom.presetPills.forEach((pill) => {
      const pillK = parseInt(pill.dataset.kelvin, 10);
      pill.classList.toggle('active', pillK === state.kelvin);
    });

    saveState();
  }

  // ---------------------------------------------------------------------------
  // AUTO-HIDE HUD LOGIC
  // ---------------------------------------------------------------------------
  let autoHideTimer = null;
  const AUTOHIDE_DELAY = 3500;

  function resetAutoHideTimer() {
    showHUD();
    clearTimeout(autoHideTimer);

    if (!state.isPinned) {
      autoHideTimer = setTimeout(() => {
        hideHUD();
      }, AUTOHIDE_DELAY);
    }
  }

  function showHUD() {
    dom.hudContainer.classList.remove('autohide-hidden');
    dom.body.classList.remove('idle-cursor');
  }

  function hideHUD() {
    if (!state.isPinned && !dom.shortcutsDialog.open) {
      dom.hudContainer.classList.add('autohide-hidden');
      if (state.isFullscreen) {
        dom.body.classList.add('idle-cursor');
      }
    }
  }

  // ---------------------------------------------------------------------------
  // FULLSCREEN API
  // ---------------------------------------------------------------------------
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  document.addEventListener('fullscreenchange', () => {
    state.isFullscreen = !!document.fullscreenElement;
    if (state.isFullscreen) {
      dom.fsEnterIcon.style.display = 'none';
      dom.fsExitIcon.style.display = 'inline';
      dom.fullscreenBtn.classList.add('active');
    } else {
      dom.fsEnterIcon.style.display = 'inline';
      dom.fsExitIcon.style.display = 'none';
      dom.fullscreenBtn.classList.remove('active');
      dom.body.classList.remove('idle-cursor');
    }
  });

  // ---------------------------------------------------------------------------
  // SCREEN WAKE LOCK API (KEEPS MONITOR FROM SLEEPING DURING STREAM)
  // ---------------------------------------------------------------------------
  let wakeLock = null;

  async function requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
          dom.wakelockPill.style.opacity = '0.5';
          dom.wakelockLabel.textContent = 'Dim allowed';
        });
        dom.wakelockPill.style.opacity = '1';
        dom.wakelockLabel.textContent = 'Awake Locked';
      } catch (err) {
        console.log('Wake Lock request error:', err);
        dom.wakelockLabel.textContent = 'Standard';
      }
    } else {
      dom.wakelockLabel.textContent = 'Active';
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
      requestWakeLock();
    }
  });

  // ---------------------------------------------------------------------------
  // WEBCAM MIRROR PREVIEW
  // ---------------------------------------------------------------------------
  let webcamStream = null;

  async function startWebcam() {
    try {
      dom.cameraPlaceholder.style.display = 'flex';
      dom.cameraPlaceholder.innerHTML = '<p>Accessing local camera...</p>';

      webcamStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });

      dom.cameraVideo.srcObject = webcamStream;
      dom.cameraPlaceholder.style.display = 'none';
      dom.cameraPreviewContainer.classList.remove('hidden');
      dom.cameraToggleBtn.classList.add('active');
      state.cameraActive = true;
    } catch (err) {
      console.warn('Webcam access error:', err);
      dom.cameraPlaceholder.innerHTML = '<p style="color:#ef4444;">Camera permission denied or camera in use.</p>';
      setTimeout(() => {
        stopWebcam();
      }, 2500);
    }
  }

  function stopWebcam() {
    if (webcamStream) {
      webcamStream.getTracks().forEach((track) => track.stop());
      webcamStream = null;
    }
    dom.cameraVideo.srcObject = null;
    dom.cameraPreviewContainer.classList.add('hidden');
    dom.cameraToggleBtn.classList.remove('active');
    state.cameraActive = false;
  }

  function toggleWebcam() {
    if (state.cameraActive) {
      stopWebcam();
    } else {
      startWebcam();
    }
  }

  // Draggable Webcam preview
  (function initDraggableCamera() {
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    dom.cameraDragHandle.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = dom.cameraPreviewContainer.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      // Remove right/top anchor to allow absolute positioning
      dom.cameraPreviewContainer.style.right = 'auto';
      dom.cameraPreviewContainer.style.left = `${initialLeft}px`;
      dom.cameraPreviewContainer.style.top = `${initialTop}px`;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      const newLeft = Math.max(10, Math.min(window.innerWidth - 270, initialLeft + deltaX));
      const newTop = Math.max(10, Math.min(window.innerHeight - 200, initialTop + deltaY));
      dom.cameraPreviewContainer.style.left = `${newLeft}px`;
      dom.cameraPreviewContainer.style.top = `${newTop}px`;
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });
  })();

  // ---------------------------------------------------------------------------
  // EVENT LISTENERS & WIRING
  // ---------------------------------------------------------------------------

  // Activity tracking for autohide
  ['mousemove', 'mousedown', 'keydown', 'touchstart'].forEach((event) => {
    window.addEventListener(event, resetAutoHideTimer, { passive: true });
  });

  // Mode Tabs Switching
  dom.modeTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      state.mode = mode;

      dom.modeTabs.forEach((t) => {
        const isActive = t === tab;
        t.classList.toggle('active', isActive);
        t.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      dom.tabPanels.forEach((panel) => {
        panel.classList.toggle('active', panel.id === `panel-${mode}`);
      });

      updateLighting();
    });
  });

  // Kelvin Slider & Steppers
  dom.kelvinSlider.addEventListener('input', (e) => {
    state.kelvin = parseInt(e.target.value, 10);
    updateLighting();
  });

  dom.kelvinMinus.addEventListener('click', () => {
    state.kelvin = Math.max(2000, state.kelvin - 100);
    updateLighting();
  });

  dom.kelvinPlus.addEventListener('click', () => {
    state.kelvin = Math.min(9500, state.kelvin + 100);
    updateLighting();
  });

  // Kelvin Presets
  dom.presetPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      state.kelvin = parseInt(pill.dataset.kelvin, 10);
      updateLighting();
    });
  });

  // Shared Brightness & Tint
  dom.brightnessSlider.addEventListener('input', (e) => {
    state.brightness = parseInt(e.target.value, 10);
    state.isOn = true;
    updateLighting();
  });

  dom.muteLightBtn.addEventListener('click', () => {
    state.isOn = !state.isOn;
    updateLighting();
  });

  dom.tintSlider.addEventListener('input', (e) => {
    state.tint = parseInt(e.target.value, 10);
    updateLighting();
  });

  // Split Mode Sliders
  dom.splitLeftSlider.addEventListener('input', (e) => {
    state.splitLeftKelvin = parseInt(e.target.value, 10);
    updateLighting();
  });
  dom.splitLeftBright.addEventListener('input', (e) => {
    state.splitLeftBrightness = parseInt(e.target.value, 10);
    updateLighting();
  });
  dom.splitRightSlider.addEventListener('input', (e) => {
    state.splitRightKelvin = parseInt(e.target.value, 10);
    updateLighting();
  });
  dom.splitRightBright.addEventListener('input', (e) => {
    state.splitRightBrightness = parseInt(e.target.value, 10);
    updateLighting();
  });
  dom.splitAngleSlider.addEventListener('input', (e) => {
    state.splitAngle = parseInt(e.target.value, 10);
    updateLighting();
  });

  // Ring Mode Sliders
  dom.ringSizeSlider.addEventListener('input', (e) => {
    state.ringSize = parseInt(e.target.value, 10);
    updateLighting();
  });
  dom.ringSoftnessSlider.addEventListener('input', (e) => {
    state.ringSoftness = parseInt(e.target.value, 10);
    updateLighting();
  });

  // RGB Mode Sliders & Presets
  dom.rgbHueSlider.addEventListener('input', (e) => {
    state.rgbHue = parseInt(e.target.value, 10);
    updateLighting();
  });
  dom.rgbSatSlider.addEventListener('input', (e) => {
    state.rgbSat = parseInt(e.target.value, 10);
    updateLighting();
  });
  dom.rgbPresetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.rgbHue = parseInt(btn.dataset.hue, 10);
      state.rgbSat = parseInt(btn.dataset.sat, 10);
      updateLighting();
    });
  });

  // Utility Actions
  dom.fullscreenBtn.addEventListener('click', toggleFullscreen);

  dom.hudPinBtn.addEventListener('click', () => {
    state.isPinned = !state.isPinned;
    dom.hudPinBtn.classList.toggle('active', state.isPinned);
    if (state.isPinned) {
      showHUD();
      clearTimeout(autoHideTimer);
    } else {
      resetAutoHideTimer();
    }
    saveState();
  });

  // Webcam buttons
  dom.cameraToggleBtn.addEventListener('click', toggleWebcam);
  dom.camCloseBtn.addEventListener('click', stopWebcam);
  dom.camFlipBtn.addEventListener('click', () => {
    state.cameraFlipped = !state.cameraFlipped;
    dom.cameraVideo.classList.toggle('unflipped', !state.cameraFlipped);
  });

  // Keyboard Shortcuts Dialog
  dom.shortcutsBtn.addEventListener('click', () => {
    dom.shortcutsDialog.showModal();
  });
  dom.shortcutsCloseBtn.addEventListener('click', () => {
    dom.shortcutsDialog.close();
  });
  dom.shortcutsConfirmBtn.addEventListener('click', () => {
    dom.shortcutsDialog.close();
  });
  dom.shortcutsDialog.addEventListener('click', (e) => {
    if (e.target === dom.shortcutsDialog) {
      dom.shortcutsDialog.close();
    }
  });

  // Window Resize
  window.addEventListener('resize', () => {
    if (state.mode === 'ring') updateLighting();
  });

  // ---------------------------------------------------------------------------
  // GLOBAL KEYBOARD SHORTCUTS
  // ---------------------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    // Avoid interfering if focus is in an input or dialog
    if (e.target.tagName === 'INPUT' && e.key !== 'Escape') {
      return;
    }

    switch (e.key) {
      case ' ':
        e.preventDefault();
        state.isOn = !state.isOn;
        updateLighting();
        break;

      case 'f':
      case 'F':
        e.preventDefault();
        toggleFullscreen();
        break;

      case 'h':
      case 'H':
        e.preventDefault();
        state.isPinned = !state.isPinned;
        dom.hudPinBtn.classList.toggle('active', state.isPinned);
        if (state.isPinned) {
          showHUD();
          clearTimeout(autoHideTimer);
        } else {
          hideHUD();
        }
        saveState();
        break;

      case 'c':
      case 'C':
        e.preventDefault();
        toggleWebcam();
        break;

      case '?':
        e.preventDefault();
        if (dom.shortcutsDialog.open) {
          dom.shortcutsDialog.close();
        } else {
          dom.shortcutsDialog.showModal();
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        state.brightness = Math.min(100, state.brightness + 5);
        state.isOn = true;
        updateLighting();
        break;

      case 'ArrowDown':
        e.preventDefault();
        state.brightness = Math.max(5, state.brightness - 5);
        updateLighting();
        break;

      case 'ArrowRight':
        e.preventDefault();
        state.kelvin = Math.min(9500, state.kelvin + 200);
        updateLighting();
        break;

      case 'ArrowLeft':
        e.preventDefault();
        state.kelvin = Math.max(2000, state.kelvin - 200);
        updateLighting();
        break;

      case '1':
      case '2':
      case '3':
      case '4':
        const modes = ['kelvin', 'split', 'ring', 'rgb'];
        const chosen = modes[parseInt(e.key, 10) - 1];
        if (chosen) {
          const tab = document.querySelector(`.mode-tab[data-mode="${chosen}"]`);
          if (tab) tab.click();
        }
        break;

      default:
        break;
    }
  });

  // ---------------------------------------------------------------------------
  // INITIALIZATION
  // ---------------------------------------------------------------------------
  // Restore pinned UI status
  if (state.isPinned) {
    dom.hudPinBtn.classList.add('active');
  }

  // Restore active tab
  const activeTab = document.querySelector(`.mode-tab[data-mode="${state.mode}"]`);
  if (activeTab) {
    activeTab.click();
  } else {
    updateLighting();
  }

  // Request screen wake lock
  requestWakeLock();

  // Kick off autohide timer
  resetAutoHideTimer();

})();
