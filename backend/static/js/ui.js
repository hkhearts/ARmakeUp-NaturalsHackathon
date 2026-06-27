import { analyzeFaceAuto, analyzeFaceManual, capturePhoto, scanBarcode, scanBarcodeManual, generateReport } from './api.js';

const PRESETS = {
    natural: { name:'Natural', colors:{foundation:'#E8C4A0',lipstick:'#C8847A',blush:'#D4967A',contour:'#B89470'}, opacity:{foundation:0.12,lipstick:0.30,blush:0.20,contour:0.15} },
    bridal:  { name:'Bridal',  colors:{foundation:'#F0D0C0',lipstick:'#C45C74',blush:'#E096A6',contour:'#B49080',bindi:'#8B0000'}, opacity:{foundation:0.20,lipstick:0.50,blush:0.30,contour:0.20,bindi:0.90} },
    party:   { name:'Party',   colors:{foundation:'#D4A87A',lipstick:'#8C3428',blush:'#C07854',contour:'#907048',eyeshadow:'#6B4E8B'}, opacity:{foundation:0.18,lipstick:0.55,blush:0.35,contour:0.25,eyeshadow:0.35} },
    glam:    { name:'Glam',    colors:{foundation:'#CCA090',lipstick:'#7C2820',blush:'#A86878',contour:'#7E6050',eyeshadow:'#8B5E3C'}, opacity:{foundation:0.22,lipstick:0.60,blush:0.40,contour:0.30,eyeshadow:0.40} },
    bold:    { name:'Bold',    colors:{foundation:'#D4A87A',lipstick:'#6C241C',blush:'#9C5E3E',contour:'#705830',eyeshadow:'#2E1A47'}, opacity:{foundation:0.20,lipstick:0.65,blush:0.40,contour:0.30,eyeshadow:0.45} },
};

const CATEGORIES = [
    { key: 'foundation', label: 'Foundation', icon: 'FND', defaultOpacity: 0.18, swatches: ['#F5D6BA','#E8C4A0','#D4A87A','#C09060','#A07850','#8C6840','#745030'] },
    { key: 'lipstick',   label: 'Lipstick',   icon: 'LIP', defaultOpacity: 0.45, swatches: ['#C8645A','#B85450','#A04838','#8C3428','#7C2820','#C45C74','#D06880'] },
    { key: 'blush',      label: 'Blush',      icon: 'BLS', defaultOpacity: 0.28, swatches: ['#E8967A','#D48C6E','#C07854','#A86878','#D48C9C','#C47C8C','#D89090'] },
    { key: 'contour',    label: 'Contour',    icon: 'CTR', defaultOpacity: 0.22, swatches: ['#C8A07A','#B8946A','#A07850','#907048','#7E6050','#6C5838','#584428'] },
    { key: 'eyeshadow',  label: 'Eyeshadow',  icon: 'EYE', defaultOpacity: 0.30, swatches: ['#8B5E3C','#6B4E8B','#2E1A47','#4A6741','#7B4F5A','#3D5A80','#9C6644'] },
    { key: 'eyeliner',   label: 'Eyeliner',   icon: 'LNR', defaultOpacity: 0.60, swatches: ['#000000','#1A1A2E','#0D0D0D','#2C1810','#1A0A2E','#0A1628','#3D0C02'] },
    { key: 'bindi',      label: 'Bindi',      icon: 'BND', defaultOpacity: 0.80, swatches: ['#8B0000','#CC0000','#FFD700','#FF4500','#800020','#C04000','#4B0082','#228B22'] },
];

export class UIController {
    constructor(renderer, appRef) {
        this.renderer = renderer;
        this.app = appRef;
        this.activeCategory = null;
        this.analysisResult = null;
        this.userName = '';
        this._panels = {};
    }

    get aiCharacter() { return this.app ? this.app.aiCharacter : null; }

    init() {
        this._initUserModal();
        this._buildMakeupUI();
        this._initPresets();
        this._initAnalyze();
        this._initManualPicker();
        this._initCapture();
        this._initClear();
        this._initPanelToggles();
        this._initBarcode();
        this._initReport();
        this._initAI();
        this._initListProducts();
        console.log('UI Controller initialized');
    }

    /* ================================================================
     * USER MODAL
     * ================================================================ */
    _initUserModal() {
        const modal = document.getElementById('user-modal');
        const input = document.getElementById('user-name-input');
        const btnUser = document.getElementById('login-user-btn');
        const btnAdmin = document.getElementById('login-admin-btn');
        const saved = localStorage.getItem('glamour_user_name');
        if (saved) { this.userName = saved; modal?.classList.remove('visible'); this._updateUser(); return; }
        if (!input) return;

        const login = (role) => {
            const name = input.value.trim();
            if (!name) { input.style.borderColor = '#f87171'; return; }
            this.userName = name;
            localStorage.setItem('glamour_user_name', name);
            localStorage.setItem('userRole', role);
            modal?.classList.remove('visible');
            this._updateUser();
            if (this.aiCharacter) setTimeout(() => this.aiCharacter.speak(`Welcome ${name}! I am your AI fashion stylist.`), 2000);
        };

        if (btnUser) btnUser.onclick = () => login('user');
        if (btnAdmin) btnAdmin.onclick = () => login('admin');
        input.onkeydown = e => { if (e.key === 'Enter') login('user'); };
    }
    _updateUser() { const el = document.getElementById('user-display'); if (el) el.textContent = this.userName; }

    /* ================================================================
     * DYNAMIC MAKEUP UI — buttons + inline swatch panels + sliders
     * ================================================================ */
    _buildMakeupUI() {
        const container = document.getElementById('makeup-buttons-container');
        if (!container) { console.error('makeup-buttons-container not found'); return; }

        CATEGORIES.forEach(cat => {
            // Button
            const btn = document.createElement('button');
            btn.className = 'category-btn';
            btn.innerHTML = `<span class="category-icon-text">${cat.icon}</span> ${cat.label}`;

            // Expandable panel (swatches + slider) — starts hidden
            const panel = document.createElement('div');
            panel.className = 'inline-panel';
            panel.style.display = 'none';

            // Swatch row
            const swatchRow = document.createElement('div');
            swatchRow.className = 'swatch-grid';
            swatchRow.id = `${cat.key}-swatches-sidebar`;
            cat.swatches.forEach(hex => {
                const sw = document.createElement('button');
                sw.className = 'color-swatch';
                sw.style.backgroundColor = hex;
                sw.title = hex;
                sw.onclick = () => {
                    swatchRow.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
                    sw.classList.add('selected');
                    this.renderer.setColor(cat.key, hex);
                };
                swatchRow.appendChild(sw);
            });

            // Slider
            const sliderRow = document.createElement('div');
            sliderRow.className = 'slider-row';
            const sliderLabel = document.createElement('span');
            sliderLabel.className = 'slider-label';
            sliderLabel.textContent = cat.key === 'bindi' ? 'Size' : 'Intensity';
            const slider = document.createElement('input');
            slider.type = 'range'; slider.min = '0'; slider.max = '1'; slider.step = '0.01';
            slider.value = String(cat.defaultOpacity);
            slider.className = 'intensity-slider';
            const valueLabel = document.createElement('span');
            valueLabel.className = 'intensity-value';
            valueLabel.textContent = `${Math.round(cat.defaultOpacity * 100)}%`;
            slider.oninput = () => {
                const v = parseFloat(slider.value);
                this.renderer.setOpacity(cat.key, v);
                valueLabel.textContent = `${Math.round(v * 100)}%`;
            };
            sliderRow.appendChild(sliderLabel);
            sliderRow.appendChild(slider);
            sliderRow.appendChild(valueLabel);

            panel.appendChild(swatchRow);
            panel.appendChild(sliderRow);

            // Toggle logic
            btn.onclick = () => {
                if (this.activeCategory === cat.key) {
                    panel.style.display = 'none';
                    btn.classList.remove('active');
                    this.activeCategory = null;
                } else {
                    // Close all others
                    Object.values(this._panels).forEach(p => { p.panel.style.display = 'none'; p.btn.classList.remove('active'); });
                    panel.style.display = 'block';
                    btn.classList.add('active');
                    this.activeCategory = cat.key;
                }
            };

            this._panels[cat.key] = { btn, panel, swatchRow, slider };
            container.appendChild(btn);
            container.appendChild(panel);
        });
    }

    updateSwatches(cat, colors) {
        const p = this._panels[cat];
        if (!p) return;
        p.swatchRow.innerHTML = '';
        colors.forEach(hex => {
            const sw = document.createElement('button');
            sw.className = 'color-swatch'; sw.style.backgroundColor = hex; sw.title = hex;
            sw.onclick = () => {
                p.swatchRow.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
                sw.classList.add('selected');
                this.renderer.setColor(cat, hex);
            };
            p.swatchRow.appendChild(sw);
        });
        // Also update results panel swatches
        const rp = document.getElementById(`${cat}-swatches`);
        if (rp) {
            rp.innerHTML = '';
            colors.forEach(hex => {
                const sw = document.createElement('button');
                sw.className = 'color-swatch'; sw.style.backgroundColor = hex; sw.title = hex;
                sw.onclick = () => this.renderer.setColor(cat, hex);
                rp.appendChild(sw);
            });
        }
    }

    /* ================================================================
     * PRESETS
     * ================================================================ */
    _initPresets() {
        const container = document.getElementById('presets-container');
        if (!container) return;
        for (const [key, preset] of Object.entries(PRESETS)) {
            const btn = document.createElement('button');
            btn.className = 'preset-btn';
            btn.textContent = preset.name;
            btn.onclick = () => {
                for (const [t, c] of Object.entries(preset.colors)) this.renderer.setColor(t, c);
                for (const [t, o] of Object.entries(preset.opacity)) {
                    this.renderer.setOpacity(t, o);
                    if (this._panels[t]) { this._panels[t].slider.value = o; }
                }
                container.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._toast(`Applied "${preset.name}" look`);
            };
            container.appendChild(btn);
        }
    }

    /* ================================================================
     * SKIN ANALYSIS
     * ================================================================ */
    _initAnalyze() {
        const btn = document.getElementById('analyze-auto-btn');
        if (btn) btn.onclick = () => this._autoAnalyze();
    }

    _initManualPicker() {
        const picker = document.getElementById('skin-color-picker');
        const btn = document.getElementById('analyze-manual-btn');
        if (btn && picker) btn.onclick = () => this._manualAnalyze(picker.value);
        const eye = document.getElementById('eyedropper-btn');
        if (eye) eye.onclick = async () => {
            if ('EyeDropper' in window) {
                try { const r = await new EyeDropper().open(); if (picker) picker.value = r.sRGBHex; await this._manualAnalyze(r.sRGBHex); } catch(e) {}
            } else this._toast('EyeDropper not supported', 'error');
        };
    }

    async _autoAnalyze() {
        const btn = document.getElementById('analyze-auto-btn');
        try {
            btn.disabled = true; btn.textContent = 'Analyzing...';
            const b64 = this.renderer.captureVideoFrame();
            const result = await analyzeFaceAuto(b64, this.userName);
            this.analysisResult = result;
            this._showResults(result);
            this._toast('Skin analysis complete!');
            if (this.aiCharacter) setTimeout(() => this.aiCharacter.suggestLook(result), 1500);
        } catch (err) { this._toast(`Failed: ${err.message}`, 'error'); }
        finally { btn.disabled = false; btn.textContent = 'Auto Analyze'; }
    }

    async _manualAnalyze(hex) {
        const btn = document.getElementById('analyze-manual-btn');
        try {
            btn.disabled = true; btn.textContent = 'Analyzing...';
            const result = await analyzeFaceManual({ hex_color: hex, user_name: this.userName });
            this.analysisResult = result;
            this._showResults(result);
            this._toast('Manual analysis complete!');
        } catch (err) { this._toast(`Failed: ${err.message}`, 'error'); }
        finally { btn.disabled = false; btn.textContent = 'Analyze Color'; }
    }

    _showResults(r) {
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('result-undertone', r.undertone);
        set('result-surface-tone', r.surface_tone);
        set('result-mode', r.mode === 'automatic' ? 'Auto' : 'Manual');
        set('result-lightness', `L*: ${r.lightness}`);
        const ut = document.getElementById('result-undertone');
        if (ut) ut.className = `undertone-badge ${r.undertone}`;
        if (r.recommendations) {
            for (const [t, c] of Object.entries(r.recommendations)) this.updateSwatches(t, c);
        }
        document.getElementById('results-panel')?.classList.add('active');
    }

    /* ================================================================
     * CAPTURE / CLEAR / PANELS
     * ================================================================ */
    _initCapture() {
        const btn = document.getElementById('capture-btn');
        if (!btn) return;
        btn.onclick = async () => {
            if (!this.userName) { this._toast('Enter name first','error'); document.getElementById('user-modal')?.classList.add('visible'); return; }
            try {
                btn.disabled = true; btn.textContent = 'Saving...';
                const blob = await this.renderer.capture();
                const b64 = await this._blobToB64(blob);
                await capturePhoto(this.userName, b64, '', { colors: {...this.renderer.colors}, opacities: {...this.renderer.opacity} });
                this._toast('Photo saved!');
                const url = URL.createObjectURL(blob);
                Object.assign(document.createElement('a'), { href: url, download: `naturals-${Date.now()}.png` }).click();
                URL.revokeObjectURL(url);
            } catch (err) { this._toast(`Failed: ${err.message}`, 'error'); }
            finally { btn.disabled = false; btn.textContent = 'Capture Look'; }
        };
    }

    _initClear() {
        const btn = document.getElementById('clear-btn');
        if (btn) btn.onclick = () => { this.renderer.clearAll(); this._toast('Cleared'); };
    }

    _initPanelToggles() {
        const btn = document.getElementById('toggle-results-btn');
        if (btn) btn.onclick = () => document.getElementById('results-panel')?.classList.toggle('active');
    }

    /* ================================================================
     * BARCODE
     * ================================================================ */
    _initBarcode() {
        const fileInput = document.getElementById('barcode-file-input');
        if (fileInput) fileInput.onchange = async e => {
            const file = e.target.files[0]; if (!file) return;
            try {
                const b64 = await this._fileToB64(file);
                const res = await scanBarcode(b64, this.userName);
                this._toast(`Scanned: ${res.product_name} ${res.colour_hex}`);
            } catch (err) { this._toast(`Scan failed: ${err.message}`, 'error'); }
        };
        const manBtn = document.getElementById('barcode-manual-btn');
        const manInput = document.getElementById('barcode-manual-input');
        if (manBtn && manInput) manBtn.onclick = async () => {
            const content = manInput.value.trim();
            if (!content) { this._toast('Enter data','error'); return; }
            try {
                manBtn.disabled = true; manBtn.textContent = 'Submitting...';
                const res = await scanBarcodeManual(content, this.userName);
                this._toast(`Saved: ${res.product_name} (${res.colour_hex})`);
                manInput.value = '';
            } catch (err) { this._toast(`Failed: ${err.message}`, 'error'); }
            finally { manBtn.disabled = false; manBtn.textContent = 'Submit Product Data'; }
        };
    }

    /* ================================================================
     * REPORT
     * ================================================================ */
    _initReport() {
        const btn = document.getElementById('report-btn');
        const modal = document.getElementById('report-modal');
        document.getElementById('report-close-btn')?.addEventListener('click', () => modal?.classList.remove('visible'));
        document.getElementById('report-download-btn')?.addEventListener('click', () => this._dlReport());
        if (!btn) return;
        btn.onclick = async () => {
            if (!this.analysisResult) { this._toast('Run analysis first','error'); return; }
            try {
                btn.disabled = true; btn.textContent = 'Generating...';
                const blob = await this.renderer.capture();
                const b64 = await this._blobToB64(blob);
                const res = await generateReport(this.userName, b64, this.analysisResult, {});
                this._renderReport(res.report, b64);
                modal?.classList.add('visible');
            } catch (err) { this._toast(`Failed: ${err.message}`, 'error'); }
            finally { btn.disabled = false; btn.textContent = 'Generate Report'; }
        };
    }

    _renderReport(rpt, img) {
        const el = document.getElementById('report-content'); if (!el) return;
        const a = rpt.analysis || {};
        el.innerHTML = `<img src="${img}" class="report-screenshot" alt="Screenshot">
            <h3>Analysis</h3>
            <div class="report-row"><span class="report-label">User</span><span class="report-value">${rpt.user_name||'Guest'}</span></div>
            <div class="report-row"><span class="report-label">Date</span><span class="report-value">${rpt.generated_at}</span></div>
            <div class="report-row"><span class="report-label">Undertone</span><span class="report-value">${a.undertone||'-'}</span></div>
            <div class="report-row"><span class="report-label">Surface</span><span class="report-value">${a.surface_tone||'-'}</span></div>
            <div class="report-row"><span class="report-label">Lightness</span><span class="report-value">${a.lightness||'-'}</span></div>`;
        this._reportCache = { rpt, img };
    }

    async _dlReport() {
        if (!this._reportCache) return;
        let t = '';
        if (this._reportCache.type === 'products') {
            t = this._reportCache.txtContent;
            try {
                // To save to the database, we use capturePhoto with a blank image
                const tmpCanvas = document.createElement('canvas');
                tmpCanvas.width = 1; tmpCanvas.height = 1;
                const blankImage = tmpCanvas.toDataURL('image/png');
                await capturePhoto(this.userName || 'Guest', blankImage, 'Database Product List Download', { is_product_report: true });
                this._toast('Product list saved to database!');
            } catch(e) {
                console.error("Failed to save product report to db", e);
            }
        } else {
            const { rpt } = this._reportCache; const a = rpt.analysis || {};
            t = `SKIN ANALYSIS REPORT\n${'='.repeat(40)}\nUser: ${rpt.user_name}\nDate: ${rpt.generated_at}\nUndertone: ${a.undertone}\nSurface: ${a.surface_tone}\nLightness: ${a.lightness}\n`;
        }
        const blob = new Blob([t], {type:'text/plain'});
        Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `report-${Date.now()}.txt` }).click();
    }

    /* ================================================================
     * AI CHARACTER
     * ================================================================ */
    _initAI() {
        document.getElementById('ai-speak-btn')?.addEventListener('click', () => {
            if (this.aiCharacter) this.aiCharacter.suggestLook(this.analysisResult);
            else this._toast('AI loading...','error');
        });
        document.getElementById('ai-listen-btn')?.addEventListener('click', () => {
            if (!this.aiCharacter) { this._toast('AI loading...','error'); return; }
            if (this.aiCharacter.isListening) this.aiCharacter.stopListening();
            else this.aiCharacter.startListening(t => this.aiCharacter.processVoiceCommand(t, this.analysisResult));
        });
        document.getElementById('ai-toggle-btn')?.addEventListener('click', () => { if (this.aiCharacter) this.aiCharacter.toggle(); });
    }

    /* ================================================================
     * LIST PRODUCTS
     * ================================================================ */
    _initListProducts() {
        const btn = document.getElementById('list-products-btn');
        if (!btn) return;
        btn.onclick = async () => {
            try {
                btn.textContent = 'Loading...';
                const resp = await fetch('/api/products/');
                const data = await resp.json();
                
                let html = `<h3>Database Products</h3>`;
                let txtContent = `DATABASE PRODUCTS\n==================\nUser: ${this.userName||'Guest'}\nDate: ${new Date().toLocaleString()}\n\n`;

                if (data.success && data.products && data.products.length > 0) {
                    const grouped = {};
                    data.products.forEach(p => {
                        const cat = p.category || 'Other';
                        if (!grouped[cat]) grouped[cat] = [];
                        grouped[cat].push(p);
                    });
                    
                    for (const [cat, prods] of Object.entries(grouped)) {
                        html += `<h4>${cat}</h4><ul>`;
                        txtContent += `[${cat}]\n`;
                        for (const p of prods) {
                            html += `<li>${p.product_name} <span style="display:inline-block;width:10px;height:10px;background:${p.colour_hex};border-radius:50%;margin-left:4px;"></span></li>`;
                            txtContent += `- ${p.product_name} (${p.colour_name}: ${p.colour_hex})\n`;
                        }
                        html += `</ul>`;
                        txtContent += `\n`;
                    }
                } else {
                    html += '<p>No products found in database.</p>';
                    txtContent += 'No products found.\n';
                }
                
                const el = document.getElementById('report-content');
                if (el) el.innerHTML = html;
                
                this._reportCache = { type: 'products', txtContent: txtContent };

                const modal = document.getElementById('report-modal');
                if (modal) modal.classList.add('visible');
            } catch(e) {
                console.error(e);
                this._toast('Error loading products', 'error');
            } finally {
                btn.textContent = 'Show Database Products';
            }
        };
    }

    /* ================================================================
     * UTILS
     * ================================================================ */
    _blobToB64(blob) { return new Promise(r => { const rd = new FileReader(); rd.onloadend = () => r(rd.result); rd.readAsDataURL(blob); }); }
    _fileToB64(file) { return this._blobToB64(file); }

    _toast(msg, type='success') {
        let c = document.getElementById('toast-container');
        if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
        const t = document.createElement('div'); t.className = `toast toast-${type}`; t.textContent = msg; c.appendChild(t);
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3000);
    }
}
