/**
 * Deepfake Defender Live - Video/Face Detector
 * Analyzes video streams for deepfakes and face swaps
 */

class VideoDetector {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.videoElements = new Map();
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.interval = null;
        this.frameRate = 2; // frames per second
        this.enabled = true;
        this.participants = new Map();
    }

    // =========================================================
    // Initialization
    // =========================================================

    async initialize() {
        console.log('🎥 Video Detector initializing...');
        
        // Load settings
        const settings = await this.apiClient.getSettings();
        this.enabled = settings.faceDetection !== false;
        this.frameRate = settings.frameRate || 2;
        
        // Start monitoring
        this.startMonitoring();
    }

    startMonitoring() {
        // Scan for video elements periodically
        setInterval(() => this.scanForVideos(), 3000);
        
        // Start frame capture if enabled
        if (this.enabled) {
            this.startFrameCapture();
        }
    }

    // =========================================================
    // Video Detection
    // =========================================================

    scanForVideos() {
        const videos = document.querySelectorAll('video');
        let newVideosFound = false;
        
        videos.forEach((video, index) => {
            const videoId = this.getVideoId(video);
            
            if (!this.videoElements.has(videoId)) {
                this.videoElements.set(videoId, {
                    element: video,
                    participantId: this.getParticipantId(video, index),
                    participantName: this.getParticipantName(video, index),
                    lastFrame: null,
                    frameCount: 0
                });
                newVideosFound = true;
            }
        });
        
        if (newVideosFound) {
            console.log(`🎥 Monitoring ${this.videoElements.size} video streams`);
        }
    }

    getVideoId(video) {
        // Generate unique ID for video element
        return video.src || video.id || video.className || Math.random().toString(36);
    }

    getParticipantId(video, index) {
        // Try to get participant ID from DOM
        const parent = video.closest('[data-participant-id]');
        if (parent) {
            return parent.dataset.participantId;
        }
        
        // Generate based on position
        return `participant_video_${index}`;
    }

    getParticipantName(video, index) {
        // Try to get participant name from DOM
        const parent = video.closest('[data-participant-name]');
        if (parent) {
            return parent.dataset.participantName;
        }
        
        // Look for name near video
        const nameElement = video.parentElement?.querySelector('.participant-name');
        if (nameElement) {
            return nameElement.textContent.trim();
        }
        
        return `Participant ${index + 1}`;
    }

    // =========================================================
    // Frame Capture
    // =========================================================

    startFrameCapture() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        
        this.interval = setInterval(() => {
            this.captureFrames();
        }, 1000 / this.frameRate);
    }

    captureFrames() {
        if (!this.apiClient.isConnected()) return;
        
        this.videoElements.forEach((videoData, videoId) => {
            const video = videoData.element;
            
            if (video.readyState === video.HAVE_ENOUGH_DATA && 
                video.videoWidth > 0 && 
                video.videoHeight > 0) {
                
                // Resize canvas to match video
                this.canvas.width = video.videoWidth;
                this.canvas.height = video.videoHeight;
                
                // Draw video frame
                this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
                
                // Convert to base64
                this.canvas.toBlob((blob) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64data = reader.result.split(',')[1];
                        
                        // Send to server
                        this.apiClient.sendFrame(base64data, videoData.participantId);
                        
                        // Update stats
                        videoData.frameCount++;
                        videoData.lastFrame = Date.now();
                        
                        // Store for analysis
                        this.updateParticipantAnalysis(videoData.participantId, {
                            confidence: 0.5, // Will be updated by server response
                            isDeepfake: false
                        });
                    };
                    reader.readAsDataURL(blob);
                }, 'image/jpeg', 0.7);
            }
        });
    }

    // =========================================================
    // Analysis Results
    // =========================================================

    updateParticipantAnalysis(participantId, analysis) {
        if (!this.participants.has(participantId)) {
            this.participants.set(participantId, {
                faceConfidence: 0.5,
                faceHistory: [],
                lastUpdate: Date.now()
            });
        }
        
        const participant = this.participants.get(participantId);
        participant.faceConfidence = analysis.confidence;
        participant.faceHistory.push({
            confidence: analysis.confidence,
            timestamp: Date.now()
        });
        
        // Keep only last 100 entries
        if (participant.faceHistory.length > 100) {
            participant.faceHistory.shift();
        }
        
        participant.lastUpdate = Date.now();
        
        // Trigger analysis event
        this.triggerAnalysisEvent(participantId, analysis);
    }

    triggerAnalysisEvent(participantId, analysis) {
        const event = new CustomEvent('dfd-video-analysis', {
            detail: {
                participantId: participantId,
                confidence: analysis.confidence,
                isDeepfake: analysis.isDeepfake,
                timestamp: Date.now()
            }
        });
        document.dispatchEvent(event);
    }

    // =========================================================
    // Face Detection Helpers
    // =========================================================

    async detectFace(frameData) {
        // Face detection logic (simplified - actual detection done by server)
        return {
            confidence: 0.5,
            isDeepfake: false
        };
    }

    calculateAverageConfidence(participantId) {
        const participant = this.participants.get(participantId);
        if (!participant || participant.faceHistory.length === 0) {
            return 0.5;
        }
        
        const sum = participant.faceHistory.reduce((acc, curr) => acc + curr.confidence, 0);
        return sum / participant.faceHistory.length;
    }

    // =========================================================
    // Controls
    // =========================================================

    enable() {
        this.enabled = true;
        this.startFrameCapture();
    }

    disable() {
        this.enabled = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    setFrameRate(fps) {
        this.frameRate = fps;
        if (this.enabled) {
            this.startFrameCapture();
        }
    }

    // =========================================================
    // Stats
    // =========================================================

    getStats() {
        return {
            videosWatched: this.videoElements.size,
            participantsTracked: this.participants.size,
            framesCaptured: Array.from(this.videoElements.values()).reduce(
                (acc, curr) => acc + curr.frameCount, 0
            ),
            averageConfidence: this.getAverageConfidence()
        };
    }

    getAverageConfidence() {
        if (this.participants.size === 0) return 0.5;
        
        let sum = 0;
        this.participants.forEach(p => {
            sum += p.faceConfidence;
        });
        return sum / this.participants.size;
    }
}

// Export for use in content scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoDetector;
}
