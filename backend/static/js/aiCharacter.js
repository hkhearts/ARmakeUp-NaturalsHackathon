/**
 * aiCharacter.js — AI Fashion Stylist Character
 * ===============================================
 * Provides an animated AI stylist avatar with:
 *  - CSS-animated avatar (fallback when Three.js/GLTF fails)
 *  - Three.js GLTF character (when available)
 *  - Speech synthesis for suggestions
 *  - Speech recognition for voice input
 *  - Context-aware fashion advice
 */

export class AICharacter {
    constructor(canvasEl, modelUrl) {
        this.canvas = canvasEl;
        this.modelUrl = modelUrl;
        this.isVisible = true;
        this.isListening = false;
        this.isSpeaking = false;
        this.recognition = null;
        this.currentAnimation = 'idle';
        this.useThreeJS = false;

        // Three.js objects (may be null)
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.model = null;
        this.bones = {};
        this.clock = null;
        this.animationTime = 0;

        // Speech synthesis
        this.synth = window.speechSynthesis || null;
        this.selectedVoice = null;
    }

    async init() {
        try {
            this._setupVoice();
        } catch (e) {
            console.warn('Voice setup failed:', e.message);
        }

        // Try Three.js GLTF loading
        if (typeof THREE !== 'undefined') {
            try {
                await this._initThreeJS();
                this.useThreeJS = true;
                console.log('AI Character: Three.js mode active');
                return true;
            } catch (err) {
                console.warn('Three.js init failed, using CSS avatar:', err.message);
            }
        }

        // Fallback: CSS animated avatar (always succeeds)
        try {
            this._initCSSAvatar();
        } catch (e) {
            console.warn('CSS avatar init failed:', e.message);
        }
        console.log('AI Character: CSS avatar mode active');
        return true;
    }

    // -------------------------------------------------------------------
    // THREE.JS MODE
    // -------------------------------------------------------------------

    async _initThreeJS() {
        this._setupScene();
        this._setupLighting();
        await this._loadModel();
        this._startThreeAnimation();
    }

    _setupScene() {
        this.scene = new THREE.Scene();
        this.clock = new THREE.Clock();

        const w = this.canvas.clientWidth || 280;
        const h = this.canvas.clientHeight || 340;

        this.camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 1000);
        this.camera.position.set(0, 145, 40);
        this.camera.lookAt(0, 145, 0);

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: true,
        });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    _setupLighting() {
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const keyLight = new THREE.DirectionalLight(0xfff0e6, 1.2);
        keyLight.position.set(5, 160, 20);
        this.scene.add(keyLight);
        const fillLight = new THREE.DirectionalLight(0xc8c0ff, 0.5);
        fillLight.position.set(-5, 150, 10);
        this.scene.add(fillLight);
    }

    async _loadModel() {
        return new Promise((resolve, reject) => {
            // Check for GLTFLoader availability
            const GLTFLoader = THREE.GLTFLoader || (THREE.loaders && THREE.loaders.GLTFLoader);
            if (!GLTFLoader) {
                reject(new Error('GLTFLoader not available'));
                return;
            }

            const loader = new GLTFLoader();
            loader.load(
                this.modelUrl,
                (gltf) => {
                    this.model = gltf.scene;
                    this.model.scale.set(1, 1, 1);
                    this.model.traverse((node) => {
                        if (node.isBone) {
                            const name = node.name || '';
                            if (name.includes('Head') && !name.includes('_0')) this.bones.head = node;
                            if (name.includes('NeckTwist01') && !name.includes('02')) this.bones.neck = node;
                            if (name.includes('Spine02') && !name.includes('_')) this.bones.spine = node;
                        }
                    });
                    this.scene.add(this.model);
                    resolve();
                },
                undefined,
                (err) => reject(err)
            );
        });
    }

    _startThreeAnimation() {
        const animate = () => {
            if (!this.isVisible || !this.useThreeJS) return;
            const delta = this.clock.getDelta();
            this.animationTime += delta;
            this._applyBoneAnimation(this.animationTime);
            this.renderer.render(this.scene, this.camera);
            requestAnimationFrame(animate);
        };
        animate();
    }

    _applyBoneAnimation(t) {
        if (this.bones.head) {
            const headAmp = this.currentAnimation === 'speaking' ? 0.06 : 0.03;
            const headSpeed = this.currentAnimation === 'speaking' ? 2.5 : 0.4;
            this.bones.head.rotation.y = Math.sin(t * headSpeed) * headAmp;
            this.bones.head.rotation.x = Math.sin(t * headSpeed * 0.7) * (headAmp * 0.5);
        }
        if (this.bones.spine) {
            this.bones.spine.rotation.x = Math.sin(t * 0.8) * 0.008;
        }
    }

    // -------------------------------------------------------------------
    // CSS AVATAR MODE (FALLBACK)
    // -------------------------------------------------------------------

    _initCSSAvatar() {
        // Replace the canvas with a CSS-animated avatar
        const container = this.canvas.parentElement || document.getElementById('ai-character-container');
        if (!container) return;

        this.canvas.style.display = 'none';

        const avatar = document.createElement('div');
        avatar.id = 'css-avatar';
        avatar.className = 'css-avatar';
        avatar.innerHTML = `
            <div class="chatbot-container">
                <div class="robot-head">
                    <div class="robot-face">
                        <div class="robot-eye left-eye"></div>
                        <div class="robot-eye right-eye"></div>
                        <div class="robot-mouth"></div>
                    </div>
                </div>
            </div>
            <div class="chatbot-badge">AI Stylist</div>
        `;

        // Insert CSS for avatar
        if (!document.getElementById('css-avatar-styles')) {
            const style = document.createElement('style');
            style.id = 'css-avatar-styles';
            style.textContent = `
                .css-avatar {
                    width: 240px; height: 160px; display: flex; flex-direction: column; align-items: center; justify-content: center;
                    border-radius: 22px; background: rgba(10,10,20,0.6); backdrop-filter: blur(12px);
                    border: 1px solid rgba(192,132,252,0.15);
                    position: relative;
                    overflow: hidden;
                }
                .chatbot-container {
                    position: relative;
                    width: 80px; height: 80px;
                    display: flex; align-items: center; justify-content: center;
                    margin-bottom: 10px;
                }
                .robot-head {
                    width: 80px; height: 70px;
                    background: linear-gradient(135deg, #4b5563 0%, #1f2937 100%);
                    border-radius: 30px;
                    border: 2px solid #9ca3af;
                    position: relative;
                    display: flex; align-items: center; justify-content: center;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                    animation: robot-idle 3s ease-in-out infinite;
                }
                .robot-face {
                    width: 60px; height: 40px;
                    background: #000;
                    border-radius: 15px;
                    display: flex; align-items: center; justify-content: space-evenly;
                    position: relative;
                }
                .robot-eye {
                    width: 14px; height: 10px;
                    background: #c084fc;
                    border-radius: 50%;
                    box-shadow: 0 0 10px #c084fc;
                    animation: robot-blink 4s infinite;
                }
                .speaking .robot-eye {
                    height: 14px;
                    animation: robot-speak 0.5s infinite alternate;
                }
                .robot-mouth {
                    position: absolute;
                    bottom: 5px;
                    width: 20px;
                    height: 3px;
                    background: #c084fc;
                    border-radius: 3px;
                    box-shadow: 0 0 5px #c084fc;
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                .speaking .robot-mouth {
                    opacity: 1;
                    animation: mouth-move 0.2s infinite alternate;
                }
                .chatbot-badge {
                    font-size: 0.8rem; font-weight: 700; letter-spacing: 1px;
                    text-transform: uppercase; color: rgba(255,255,255,0.9);
                    background: rgba(192,132,252,0.2);
                    padding: 4px 12px; border-radius: 12px;
                    margin-top: 5px;
                }
                @keyframes robot-idle { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
                @keyframes robot-blink { 0%,96%,98%,100%{transform:scaleY(1)} 97%,99%{transform:scaleY(0.1)} }
                @keyframes robot-speak { 0% { transform: scale(1); box-shadow: 0 0 10px #c084fc; } 100% { transform: scale(1.3); box-shadow: 0 0 20px #fb7185; background: #fb7185; } }
                @keyframes mouth-move { 0% { width: 10px; height: 3px; } 100% { width: 25px; height: 8px; } }
            `;
            document.head.appendChild(style);
        }

        container.insertBefore(avatar, container.firstChild);
        this._avatarEl = avatar;
    }

    _setCSSAnimation(state) {
        if (!this._avatarEl) return;
        const container = this._avatarEl.querySelector('.chatbot-container');
        if (container) {
            container.classList.toggle('speaking', state === 'speaking');
        }
    }

    // -------------------------------------------------------------------
    // SPEECH
    // -------------------------------------------------------------------

    _setupVoice() {
        if (!this.synth) return;
        const setVoice = () => {
            const voices = this.synth.getVoices();
            this.selectedVoice = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female'))
                || voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('zira'))
                || voices.find(v => v.lang.startsWith('en'))
                || voices[0];
        };
        if (this.synth.getVoices().length) setVoice();
        else this.synth.addEventListener('voiceschanged', setVoice, { once: true });
    }

    speak(text) {
        if (!text) return;
        
        // Always show text reply immediately
        this._showSpeechBubble(text);
        this.currentAnimation = 'speaking';
        this.isSpeaking = true;
        this._setCSSAnimation('speaking');

        const fallbackEnd = () => {
            this.isSpeaking = false;
            this.currentAnimation = 'idle';
            this._setCSSAnimation('idle');
            setTimeout(() => this._hideSpeechBubble(), 4000);
        };

        if (!this.synth || !window.SpeechSynthesisUtterance) {
            setTimeout(fallbackEnd, 3000);
            return;
        }

        try {
            this.synth.cancel(); // Clear any pending speech
        } catch(e) {}

        setTimeout(() => {
            try {
                const utterance = new SpeechSynthesisUtterance(text);
                if (this.selectedVoice) utterance.voice = this.selectedVoice;
                utterance.rate = 0.95;
                utterance.pitch = 1.1;

                utterance.onend = fallbackEnd;
                utterance.onerror = fallbackEnd;

                this.synth.speak(utterance);
            } catch (err) {
                console.error("Speech Synthesis Error:", err);
                setTimeout(fallbackEnd, 3000);
            }
        }, 50); // slight delay to ensure cancel finishes
    }

    startListening(callback) {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this._showSpeechBubble('Voice recognition is not supported in this browser.');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'en-US';
        this.recognition.interimResults = false;
        this.recognition.continuous = false;

        this.isListening = true;
        this.currentAnimation = 'listening';
        this._showSpeechBubble('Listening... speak now.');

        const listenBtn = document.getElementById('ai-listen-btn');
        if (listenBtn) listenBtn.classList.add('listening');

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            this._hideSpeechBubble();
            if (callback) callback(transcript);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.currentAnimation = 'idle';
            if (listenBtn) listenBtn.classList.remove('listening');
        };

        this.recognition.onerror = (event) => {
            this.isListening = false;
            this.currentAnimation = 'idle';
            if (listenBtn) listenBtn.classList.remove('listening');
            this._showSpeechBubble('Could not understand. Please try again.');
        };

        this.recognition.start();
    }

    stopListening() {
        if (this.recognition) {
            this.recognition.stop();
            this.isListening = false;
        }
    }

    // -------------------------------------------------------------------
    // FASHION SUGGESTIONS
    // -------------------------------------------------------------------

    suggestLook(analysisResult) {
        if (!analysisResult) {
            this.speak("I need to analyze your skin first. Click the Auto Analyze button to get started.");
            return;
        }

        const undertone = analysisResult.undertone || 'neutral';
        const surfaceTone = analysisResult.surface_tone || 'medium';

        const suggestions = {
            warm: {
                fair: "For your warm, fair skin, I recommend peach-toned blush, coral lipstick, and golden foundation. Earthy eyeshadow shades would complement you beautifully.",
                light: "With your warm, light complexion, try honey-toned foundation, warm rose lipstick, and apricot blush.",
                medium: "Your warm, medium skin looks amazing with terracotta blush, warm red lipstick, and caramel foundation.",
                tan: "For your warm, tan skin, deep coral lipstick, warm bronze blush, and rich golden foundation will enhance your natural glow.",
                deep: "Your warm, deep skin pairs perfectly with deep berry lipstick, rich plum blush, and mahogany foundation.",
            },
            cool: {
                fair: "For your cool, fair skin, rose-pink blush, mauve lipstick, and porcelain foundation work beautifully.",
                light: "With your cool, light complexion, try pink-toned foundation, berry lipstick, and soft pink blush.",
                medium: "Your cool, medium skin is enhanced by plum lipstick, raspberry blush, and neutral beige foundation.",
                tan: "For your cool, tan skin, deep mauve lipstick and dusty rose blush bring out your best features.",
                deep: "Your cool, deep skin shines with deep wine lipstick, plum blush, and rich espresso foundation.",
            },
            neutral: {
                fair: "Your neutral, fair skin is versatile. Try dusty rose lipstick, soft peach blush, and light beige foundation.",
                light: "With your neutral, light tone, you can pull off both warm and cool shades. Nude-pink lipstick is a great start.",
                medium: "Your neutral, medium skin works with a wide range. Try warm nude lipstick, soft mauve blush.",
                tan: "For your neutral, tan skin, try a warm nude lipstick and peachy-pink blush. You have great versatility.",
                deep: "Your neutral, deep skin looks beautiful with rich brown lipstick and warm plum blush.",
            },
        };

        const toneGroup = suggestions[undertone] || suggestions.neutral;
        const advice = toneGroup[surfaceTone] || toneGroup.medium;
        this.speak(advice);
    }

    async processVoiceCommand(transcript, analysisResult) {
        this._showSpeechBubble("Thinking...");
        
        let productsInfo = "No products found.";
        try {
            const resp = await fetch('/api/products/');
            const data = await resp.json();
            if (data.success && data.products && data.products.length > 0) {
                const grouped = {};
                data.products.forEach(p => {
                    const cat = p.category || 'Other';
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push(`${p.product_name} (${p.colour_name})`);
                });
                productsInfo = Object.entries(grouped).map(([c, list]) => `${c}: ${list.join(', ')}`).join(' | ');
            }
        } catch(e) {
            console.error("Failed to fetch products for AI:", e);
        }

        const apiKey = "AIzaSyAHw5EoISpvSAZ3EMr_mGui8G3ilIAeNDo";
        const prompt = `You are an AI Beauty Chatbot for Naturals AR Studio. 
The user said: "${transcript}". 
Skin Analysis Data: Undertone=${analysisResult?.undertone || 'unknown'}, Surface Tone=${analysisResult?.surface_tone || 'unknown'}. 
Database Products available: ${productsInfo}. 

Answer the user based on your beauty tech analysis. If they ask about products or list of products, mention the ones from the database that fit their analysis. Keep the response concise, conversational, and no more than 3-4 sentences.`;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });
            const data = await response.json();
            if (data.candidates && data.candidates.length > 0) {
                const text = data.candidates[0].content.parts[0].text;
                // Remove markdown boldings and asterisks so speech synthesis sounds normal
                const cleanText = text.replace(/\\*\\*/g, '').replace(/\\*/g, '');
                this.speak(cleanText);
            } else {
                this.speak("I couldn't generate a response. Please try again.");
            }
        } catch (error) {
            console.error('Gemini API Error:', error);
            this.speak("I am having trouble connecting to my beauty intelligence right now.");
        }
    }

    // -------------------------------------------------------------------
    // SPEECH BUBBLE
    // -------------------------------------------------------------------

    _showSpeechBubble(text) {
        const bubble = document.getElementById('ai-speech-bubble');
        const textEl = document.getElementById('ai-speech-text');
        if (bubble && textEl) {
            textEl.textContent = text;
            bubble.classList.remove('hidden');
        }
    }

    _hideSpeechBubble() {
        const bubble = document.getElementById('ai-speech-bubble');
        if (bubble) bubble.classList.add('hidden');
    }

    // -------------------------------------------------------------------
    // VISIBILITY
    // -------------------------------------------------------------------

    toggle() {
        this.isVisible = !this.isVisible;
        const toggleBtn = document.getElementById('ai-toggle-btn');
        if (toggleBtn) toggleBtn.textContent = this.isVisible ? 'Hide' : 'Show';
        
        if (this._avatarEl) this._avatarEl.style.display = this.isVisible ? 'flex' : 'none';
        if (this.canvas) this.canvas.style.display = (this.isVisible && this.useThreeJS) ? 'block' : 'none';
        if (!this.isVisible) this._hideSpeechBubble();
    }

    destroy() {
        if (this.recognition) this.recognition.stop();
        if (this.synth) this.synth.cancel();
        if (this.renderer) this.renderer.dispose();
    }
}
