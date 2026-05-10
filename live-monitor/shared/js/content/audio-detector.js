/**
 * Deepfake Defender Live - Audio/Voice Detector
 * Analyzes audio streams for synthetic voices and voice cloning
 */

class AudioDetector {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.stream = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.interval = null;
        this.enabled = true;
        this.participants = new Map();
        this.sampleRate = 16000;
        this.chunkDuration = 2; // seconds
    }

    // =========================================================
    // Initialization
    // =========================================================

    async initialize() {
        console.log('🎤 Audio Detector initializing...');
        
        // Load settings
        const settings = await this.apiClient.getSettings();
        this.enabled = settings.voiceDetection !== false;
        
        // Initialize audio context
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: this.sampleRate
        });
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        
        // Request microphone access
        if (this.enabled) {
            await this.requestMicrophoneAccess();
        }
    }

    // =========================================================
    // Microphone Access
    // =========================================================

    async requestMicrophoneAccess() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                } 
            });
            
            // Set up audio processing
            this.source = this.audioContext.createMediaStreamSource(this.stream);
            this.source.connect(this.analyser);
            
            // Set up recording
            this.setupRecording();
            
            // Start analysis
            this.startAnalysis();
            
            console.log('✅ Microphone access granted');
        } catch (error) {
            console.error('❌ Microphone access denied:', error);
            this.enabled = false;
        }
    }

    setupRecording() {
        this.mediaRecorder = new MediaRecorder(this.stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.audioChunks.push(event.data);
            }
        };
        
        this.mediaRecorder.onstop = () => {
            this.processAudioChunk();
        };
    }

    // =========================================================
    // Audio Analysis
    // =========================================================

    startAnalysis() {
        // Record in chunks
        setInterval(() => {
            if (this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
                this.mediaRecorder.start();
                setTimeout(() => {
                    if (this.mediaRecorder.state === 'recording') {
                        this.mediaRecorder.stop();
                    }
                }, this.chunkDuration * 1000);
            }
        }, this.chunkDuration * 1000);
    }

    processAudioChunk() {
        if (this.audioChunks.length === 0) return;
        
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.audioChunks = [];
        
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result.split(',')[1];
            
            // Send to server for ENF analysis
            if (this.apiClient.isConnected()) {
                this.apiClient.sendAudio(base64data);
            }
            
            // Perform local analysis
            this.analyzeAudioLocally(base64data);
        };
        reader.readAsDataURL(audioBlob);
    }

    async analyzeAudioLocally(audioData) {
        // Convert base64 to audio buffer for analysis
        const audioBuffer = await this.base64ToAudioBuffer(audioData);
        
        // Extract features for ENF analysis
        const features = this.extractAudioFeatures(audioBuffer);
        
        // Check for ENF (Electrical Network Frequency) signature
        const enfResult = this.detectENF(features);
        
        // Update participant analysis
        this.updateParticipantAnalysis('self', {
            confidence: enfResult.confidence,
            isDeepfake: enfResult.isDeepfake,
            enfDetected: enfResult.enfDetected
        });
    }

    async base64ToAudioBuffer(base64) {
        // Decode base64 to audio buffer
        const response = await fetch(`data:audio/webm;base64,${base64}`);
        const arrayBuffer = await response.arrayBuffer();
        return await this.audioContext.decodeAudioData(arrayBuffer);
    }

    extractAudioFeatures(audioBuffer) {
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        
        // Extract spectral features
        const fftSize = 2048;
        const fft = new Float32Array(fftSize);
        
        // Simple spectral centroid calculation
        let centroid = 0;
        let totalMagnitude = 0;
        
        for (let i = 0; i < fftSize / 2; i++) {
            const magnitude = Math.abs(channelData[i]);
            centroid += i * magnitude;
            totalMagnitude += magnitude;
        }
        
        centroid = centroid / (totalMagnitude || 1);
        
        // Extract zero-crossing rate
        let zeroCrossings = 0;
        for (let i = 1; i < channelData.length; i++) {
            if ((channelData[i] >= 0 && channelData[i - 1] < 0) ||
                (channelData[i] < 0 && channelData[i - 1] >= 0)) {
                zeroCrossings++;
            }
        }
        
        return {
            spectralCentroid: centroid,
            zeroCrossingRate: zeroCrossings / channelData.length,
            rms: Math.sqrt(channelData.reduce((acc, val) => acc + val * val, 0) / channelData.length)
        };
    }

    detectENF(features) {
        // Simplified ENF detection (grid frequency analysis)
        // Real ENF is around 50Hz or 60Hz depending on region
        
        const expectedENF = 50; // Assume 50Hz grid (EU)
        const detectedENF = features.spectralCentroid;
        const deviation = Math.abs(detectedENF - expectedENF) / expectedENF;
        
        // Lower deviation = more likely real recording
        const confidence = Math.min(1, 1 - deviation);
        const isDeepfake = deviation > 0.1; // More than 10% deviation = fake
        
        return {
            confidence,
            isDeepfake,
            enfDetected: deviation < 0.2
        };
    }

    // =========================================================
    // Participant Management
    // =========================================================

    updateParticipantAnalysis(participantId, analysis) {
        if (!this.participants.has(participantId)) {
            this.participants.set(participantId, {
                voiceConfidence: 0.5,
                voiceHistory: [],
                lastUpdate: Date.now()
            });
        }
        
        const participant = this.participants.get(participantId);
        participant.voiceConfidence = analysis.confidence;
        participant.voiceHistory.push({
            confidence: analysis.confidence,
            enfDetected: analysis.enfDetected,
            timestamp: Date.now()
        });
        
        // Keep only last 100 entries
        if (participant.voiceHistory.length > 100) {
            participant.voiceHistory.shift();
        }
        
        participant.lastUpdate = Date.now();
        
        // Trigger analysis event
        this.triggerAnalysisEvent(participantId, analysis);
    }

    triggerAnalysisEvent(participantId, analysis) {
        const event = new CustomEvent('dfd-audio-analysis', {
            detail: {
                participantId: participantId,
                confidence: analysis.confidence,
                isDeepfake: analysis.isDeepfake,
                enfDetected: analysis.enfDetected,
                timestamp: Date.now()
            }
        });
        document.dispatchEvent(event);
    }

    // =========================================================
    // Controls
    // =========================================================

    enable() {
        this.enabled = true;
        this.requestMicrophoneAccess();
    }

    disable() {
        this.enabled = false;
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.mediaRecorder) {
            this.mediaRecorder = null;
        }
    }

    // =========================================================
    // Stats
    // =========================================================

    getStats() {
        return {
            participantsTracked: this.participants.size,
            audioChunksProcessed: this.audioChunks.length,
            averageConfidence: this.getAverageConfidence()
        };
    }

    getAverageConfidence() {
        if (this.participants.size === 0) return 0.5;
        
        let sum = 0;
        this.participants.forEach(p => {
            sum += p.voiceConfidence;
        });
        return sum / this.participants.size;
    }
}

// Export for use in content scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioDetector;
}
