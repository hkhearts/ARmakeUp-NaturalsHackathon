/**
 * ui.js — UI Interactions & Animations
 * =====================================
 * Handles all UI state: panel toggles, color swatch selection,
 * intensity sliders, preset looks, screenshot export, manual
 * color picker, and micro-animations.
 */

import { analyzeFaceAuto, analyzeFaceManual } from './api.js';

// -----------------------------------------------------------------------
// Preset Looks — curated color combinations
// -----------------------------------------------------------------------
export const PRESET_LOOKS = {
    natural: {
        name: 'Natural',
        icon: '🌿',
        colors: {
            foundation: '#E8C4A0',
            lipstick: '#C8847A',
            blush: '#D4967A',
            contour: '#B89470',
        },
        opacity: {
            foundation: 0.12,
            lipstick: 0.30,
            blush: 0.20,
            contour: 0.15,
        },
    },
    bridal: {
        name: 'Bridal',
        icon: '💍',
        colors: {
            foundation: '#F0D0C0',
            lipstick: '#C45C74',
            blush: '#E096A6',
            contour: '#B49080',
        },
        opacity: {
            foundation: 0.20,
            lipstick: 0.50,
            blush: 0.30,
            contour: 0.20,
        },
    },
    party: {
        name: 'Party',
        icon: '🎉',
        colors: {
            foundation: '#D4A87A',
            lipstick: '#8C3428',
            blush: '#C07854',
            contour: '#907048',
            eyeshadow: '#6B4E8B',
            eyeliner: '#1A1A2E',
        },
        opacity: {
            foundation: 0.18,
            lipstick: 0.55,
            blush: 0.35,
            contour: 0.25,
            eyeshadow: 0.35,
            eyeliner: 0.65,
        },
    },
    glam: {
        name: 'Glam',
        icon: '✨',
        colors: {
            foundation: '#CCA090',
            lipstick: '#7C2820',
            blush: '#A86878',
            contour: '#7E6050',
            eyeshadow: '#8B5E3C',
            eyeliner: '#0D0D0D',
        },
        opacity: {
            foundation: 0.22,
            lipstick: 0.60,
            blush: 0.40,
            contour: 0.30,
            eyeshadow: 0.40,
            eyeliner: 0.70,
        },
    },
    bold: {
        name: 'Bold',
        icon: '🔥',
        colors: {
            foundation: '#D4A87A',
            lipstick: '#6C241C',
            blush: '#9C5E3E',
            contour: '#705830',
            eyeshadow: '#2E1A47',
            eyeliner: '#000000',
        },
        opacity: {
            foundation: 0.20,
            lipstick: 0.65,
            blush: 0.40,
            contour: 0.30,
            eyeshadow: 0.45,
            eyeliner: 0.75,
        },
    },
};

export class UIController {
    /**
     * @param {MakeupRenderer} renderer
     */
    constructor(renderer) {
        this.renderer = renderer;
        this.activeCategory = null;
        this.analysisResult = null;
        this._boundHandlers = [];
    }

    /**
     * Initialize all UI event handlers.
     */
    init() {
        this._initCategoryButtons();
        this._initPresetButtons();
        this._initSliders();
        this._initAnalyzeButton();
        this._initManualColorPicker();
        this._initCaptureButton();
        this._initClearButton();
        this._initPanelToggles();
        this._populateDefaultSwatches();
    }

    // -------------------------------------------------------------------
    // Category Buttons (Foundation, Lipstick, Blush, Contour)
    // -------------------------------------------------------------------

    _initCategoryButtons() {
        const buttons = document.querySelectorAll('.category-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.dataset.category;
                this._toggleCategory(category, btn);
            });
        });
    }

    _toggleCategory(category, btn) {
        const panel = document.getElementById(`${category}-panel`);
        const allPanels = document.querySelectorAll('.color-panel');
        const allBtns = document.querySelectorAll('.category-btn');

        if (this.activeCategory === category) {
            // Close
            panel?.classList.remove('active');
            btn.classList.remove('active');
            this.activeCategory = null;
        } else {
            // Close others, open this one
            allPanels.forEach(p => p.classList.remove('active'));
            allBtns.forEach(b => b.classList.remove('active'));
            panel?.classList.add('active');
            btn.classList.add('active');
            this.activeCategory = category;
        }
    }

    // -------------------------------------------------------------------
    // Color Swatches
    // -------------------------------------------------------------------

    /**
     * Populate color swatches for a category into both results panel and sidebar.
     */
    populateSwatches(category, colors) {
        // Populate into both containers (results panel + sidebar)
        const containerIds = [`${category}-swatches`, `${category}-swatches-sidebar`];
        for (const id of containerIds) {
            const container = document.getElementById(id);
            if (!container) continue;

            container.innerHTML = '';
            colors.forEach(hex => {
                const swatch = document.createElement('button');
                swatch.className = 'color-swatch';
                swatch.style.backgroundColor = hex;
                swatch.dataset.color = hex;
                swatch.title = hex;
                swatch.addEventListener('click', () => {
                    this._selectSwatch(category, hex, swatch);
                });
                container.appendChild(swatch);
            });
        }
    }

    /**
     * Load default color swatches into sidebar panels so users can pick immediately.
     */
    _populateDefaultSwatches() {
        const defaults = {
            foundation: ['#F5D6BA', '#E8C4A0', '#D4A87A', '#C09060', '#A07850', '#8C6840', '#745030'],
            lipstick:   ['#C8645A', '#B85450', '#A04838', '#8C3428', '#7C2820', '#C45C74', '#D06880'],
            blush:      ['#E8967A', '#D48C6E', '#C07854', '#A86878', '#D48C9C', '#C47C8C', '#D89090'],
            contour:    ['#C8A07A', '#B8946A', '#A07850', '#907048', '#7E6050', '#6C5838', '#584428'],
            eyeshadow:  ['#8B5E3C', '#6B4E8B', '#2E1A47', '#4A6741', '#7B4F5A', '#3D5A80', '#9C6644'],
            eyeliner:   ['#000000', '#1A1A2E', '#0D0D0D', '#2C1810', '#1A0A2E', '#0A1628', '#3D0C02'],
        };

        for (const [category, colors] of Object.entries(defaults)) {
            this.populateSwatches(category, colors);
        }
    }

    _selectSwatch(category, hex, swatchEl) {
        // Update active state in the same container
        const container = swatchEl.parentElement;
        container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        swatchEl.classList.add('selected');

        // Apply to renderer
        this.renderer.setColor(category, hex);

        // Update the color display label
        const label = document.getElementById(`${category}-color-label`);
        if (label) label.textContent = hex;
    }

    // -------------------------------------------------------------------
    // Intensity Sliders
    // -------------------------------------------------------------------

    _initSliders() {
        const sliders = document.querySelectorAll('.intensity-slider');
        sliders.forEach(slider => {
            slider.addEventListener('input', (e) => {
                const category = slider.dataset.category;
                const value = parseFloat(e.target.value);
                this.renderer.setOpacity(category, value);

                // Update label
                const label = document.getElementById(`${category}-intensity-label`);
                if (label) label.textContent = `${Math.round(value * 100)}%`;
            });
        });
    }

    // -------------------------------------------------------------------
    // Preset Looks
    // -------------------------------------------------------------------

    _initPresetButtons() {
        const container = document.getElementById('presets-container');
        if (!container) return;

        for (const [key, preset] of Object.entries(PRESET_LOOKS)) {
            const btn = document.createElement('button');
            btn.className = 'preset-btn';
            btn.dataset.preset = key;
            btn.innerHTML = `<span class="preset-icon">${preset.icon}</span><span class="preset-name">${preset.name}</span>`;
            btn.addEventListener('click', () => this._applyPreset(key));
            container.appendChild(btn);
        }
    }

    _applyPreset(key) {
        const preset = PRESET_LOOKS[key];
        if (!preset) return;

        // Apply colors
        for (const [type, color] of Object.entries(preset.colors)) {
            this.renderer.setColor(type, color);
        }

        // Apply opacities
        for (const [type, opacity] of Object.entries(preset.opacity)) {
            this.renderer.setOpacity(type, opacity);
            const slider = document.querySelector(`.intensity-slider[data-category="${type}"]`);
            if (slider) slider.value = opacity;
            const label = document.getElementById(`${type}-intensity-label`);
            if (label) label.textContent = `${Math.round(opacity * 100)}%`;
        }

        // Update active preset button
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        const activeBtn = document.querySelector(`.preset-btn[data-preset="${key}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        // Flash notification
        this._showToast(`Applied "${preset.name}" look`);
    }

    // -------------------------------------------------------------------
    // Analyze Buttons (Auto + Manual)
    // -------------------------------------------------------------------

    _initAnalyzeButton() {
        const autoBtn = document.getElementById('analyze-auto-btn');
        if (autoBtn) {
            autoBtn.addEventListener('click', () => this._runAutoAnalysis());
        }
    }

    _initManualColorPicker() {
        const picker = document.getElementById('skin-color-picker');
        const manualBtn = document.getElementById('analyze-manual-btn');

        if (manualBtn && picker) {
            manualBtn.addEventListener('click', () => {
                this._runManualAnalysis(picker.value);
            });
        }

        // Also support eyedropper / canvas pixel picking
        const eyedropperBtn = document.getElementById('eyedropper-btn');
        if (eyedropperBtn) {
            eyedropperBtn.addEventListener('click', () => this._runEyedropper());
        }
    }

    async _runAutoAnalysis() {
        const btn = document.getElementById('analyze-auto-btn');
        const resultsPanel = document.getElementById('results-panel');

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Analyzing...';

            // Capture current video frame
            const base64 = this.renderer.captureVideoFrame();

            const result = await analyzeFaceAuto(base64);
            this.analysisResult = result;

            // Update results panel
            this._displayResults(result);

            // Populate swatches from recommendations
            for (const [type, colors] of Object.entries(result.recommendations)) {
                this.populateSwatches(type, colors);
            }

            // Show results panel
            resultsPanel?.classList.add('active');
            this._showToast('Skin analysis complete!');

        } catch (err) {
            console.error('Auto analysis failed:', err);
            this._showToast(`Analysis failed: ${err.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '🔍 Auto Analyze';
        }
    }

    async _runManualAnalysis(hexColor) {
        const btn = document.getElementById('analyze-manual-btn');
        const resultsPanel = document.getElementById('results-panel');

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Analyzing...';

            const result = await analyzeFaceManual({ hex_color: hexColor });
            this.analysisResult = result;

            this._displayResults(result);

            for (const [type, colors] of Object.entries(result.recommendations)) {
                this.populateSwatches(type, colors);
            }

            resultsPanel?.classList.add('active');
            this._showToast('Manual analysis complete!');

        } catch (err) {
            console.error('Manual analysis failed:', err);
            this._showToast(`Analysis failed: ${err.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '🎨 Analyze Color';
        }
    }

    async _runEyedropper() {
        // Use the EyeDropper API if available (Chrome 95+)
        if ('EyeDropper' in window) {
            try {
                const eyeDropper = new EyeDropper();
                const result = await eyeDropper.open();
                const picker = document.getElementById('skin-color-picker');
                if (picker) picker.value = result.sRGBHex;
                await this._runManualAnalysis(result.sRGBHex);
            } catch (err) {
                console.log('EyeDropper cancelled');
            }
        } else {
            this._showToast('EyeDropper API not supported in this browser', 'error');
        }
    }

    _displayResults(result) {
        const undertoneEl = document.getElementById('result-undertone');
        const surfaceToneEl = document.getElementById('result-surface-tone');
        const modeEl = document.getElementById('result-mode');
        const lightnessEl = document.getElementById('result-lightness');

        if (undertoneEl) {
            undertoneEl.textContent = result.undertone.charAt(0).toUpperCase() + result.undertone.slice(1);
            undertoneEl.className = `undertone-badge ${result.undertone}`;
        }
        if (surfaceToneEl) surfaceToneEl.textContent = result.surface_tone.charAt(0).toUpperCase() + result.surface_tone.slice(1);
        if (modeEl) modeEl.textContent = result.mode === 'automatic' ? '🔍 Auto-detected' : '🎨 Manual';
        if (lightnessEl) lightnessEl.textContent = `L*: ${result.lightness}`;
    }

    // -------------------------------------------------------------------
    // Capture / Export
    // -------------------------------------------------------------------

    _initCaptureButton() {
        const btn = document.getElementById('capture-btn');
        if (btn) {
            btn.addEventListener('click', async () => {
                const blob = await this.renderer.capture();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `glamour-look-${Date.now()}.png`;
                a.click();
                URL.revokeObjectURL(url);
                this._showToast('Image saved!');
            });
        }
    }

    // -------------------------------------------------------------------
    // Clear All
    // -------------------------------------------------------------------

    _initClearButton() {
        const btn = document.getElementById('clear-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                this.renderer.clearAll();
                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                this._showToast('Makeup cleared');
            });
        }
    }

    // -------------------------------------------------------------------
    // Panel Toggles
    // -------------------------------------------------------------------

    _initPanelToggles() {
        const toggleBtn = document.getElementById('toggle-results-btn');
        const resultsPanel = document.getElementById('results-panel');
        if (toggleBtn && resultsPanel) {
            toggleBtn.addEventListener('click', () => {
                resultsPanel.classList.toggle('active');
            });
        }

        const toggleSidebar = document.getElementById('toggle-sidebar-btn');
        const sidebar = document.getElementById('sidebar');
        if (toggleSidebar && sidebar) {
            toggleSidebar.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
            });
        }
    }

    // -------------------------------------------------------------------
    // Toast Notifications
    // -------------------------------------------------------------------

    _showToast(message, type = 'success') {
        const container = document.getElementById('toast-container') || this._createToastContainer();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => toast.classList.add('show'));

        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    _createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
        return container;
    }

    /**
     * Clean up event listeners.
     */
    destroy() {
        // Cleanup if needed
    }
}
