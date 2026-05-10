/**
 * Deepfake Defender Live - Chat Detector
 * Analyzes chat messages for AI-generated content
 */

class ChatDetector {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.chatElements = new Set();
        this.messageHistory = [];
        this.enabled = true;
        this.observer = null;
        this.detectionThreshold = 0.6;
        
        // AI text patterns
        this.aiPatterns = [
            /^(as an ai|i'm an ai|as an artificial intelligence|i don't have personal|i'm not capable)/i,
            /^(in conclusion|to summarize|firstly|secondly|lastly|in summary)/i,
            /^(there are several|there are multiple|there are many)/i,
            /^(it is important to note|it's worth noting|it should be noted)/i,
            /\b(additionally|furthermore|moreover|consequently|nevertheless)\b/i,
            /\b(envision|delve|navigate|unpack|leverage|synergy|paradigm)\b/i
        ];
    }

    // =========================================================
    // Initialization
    // =========================================================

    async initialize() {
        console.log('💬 Chat Detector initializing...');
        
        // Load settings
        const settings = await this.apiClient.getSettings();
        this.enabled = settings.chatDetection !== false;
        this.detectionThreshold = settings.chatThreshold || 0.6;
        
        // Start monitoring
        this.startMonitoring();
    }

    // =========================================================
    // Chat Monitoring
    // =========================================================

    startMonitoring() {
        // Initial scan for chat elements
        this.scanForChat();
        
        // Set up observer for dynamic content
        this.observer = new MutationObserver((mutations) => {
            let newMessages = false;
            
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (this.isChatMessage(node)) {
                            this.processMessage(node);
                            newMessages = true;
                        }
                    });
                }
            });
            
            if (newMessages) {
                this.scanForChat();
            }
        });
        
        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    scanForChat() {
        // Platform-specific chat detection
        if (window.location.hostname.includes('meet.google.com')) {
            this.scanGoogleMeetChat();
        } else if (window.location.hostname.includes('zoom.us')) {
            this.scanZoomChat();
        } else if (window.location.hostname.includes('teams.microsoft.com')) {
            this.scanTeamsChat();
        }
    }

    scanGoogleMeetChat() {
        // Google Meet chat messages
        const messages = document.querySelectorAll('[data-message-text]');
        messages.forEach(msg => {
            if (!this.chatElements.has(msg)) {
                this.chatElements.add(msg);
                this.processMessage(msg);
            }
        });
    }

    scanZoomChat() {
        // Zoom chat messages
        const messages = document.querySelectorAll('.chat-message__message');
        messages.forEach(msg => {
            if (!this.chatElements.has(msg)) {
                this.chatElements.add(msg);
                this.processMessage(msg);
            }
        });
    }

    scanTeamsChat() {
        // Teams chat messages
        const messages = document.querySelectorAll('[data-tid="message-body"]');
        messages.forEach(msg => {
            if (!this.chatElements.has(msg)) {
                this.chatElements.add(msg);
                this.processMessage(msg);
            }
        });
    }

    // =========================================================
    // Message Processing
    // =========================================================

    isChatMessage(node) {
        if (!node.nodeType === Node.ELEMENT_NODE) return false;
        
        const className = node.className || '';
        return (
            className.includes('message') ||
            className.includes('chat') ||
            node.hasAttribute('data-message-text') ||
            node.closest('[role="listitem"]') !== null
        );
    }

    processMessage(messageElement) {
        const messageText = this.extractMessageText(messageElement);
        const sender = this.extractSender(messageElement);
        
        if (!messageText || messageText.length < 10) return;
        
        // Analyze message
        const analysis = this.analyzeMessage(messageText);
        
        // Store in history
        this.messageHistory.push({
            text: messageText,
            sender: sender,
            analysis: analysis,
            timestamp: Date.now(),
            element: messageElement
        });
        
        // Keep history manageable
        if (this.messageHistory.length > 200) {
            this.messageHistory.shift();
        }
        
        // Highlight if suspicious
        if (analysis.isAIGenerated) {
            this.highlightMessage(messageElement, analysis);
        }
        
        // Send to server if connected
        if (this.apiClient.isConnected()) {
            this.apiClient.sendChatMessage(messageText, sender);
        }
        
        // Trigger event
        this.triggerChatEvent({
            text: messageText,
            sender: sender,
            analysis: analysis
        });
    }

    extractMessageText(element) {
        // Try different selectors based on platform
        let text = '';
        
        if (element.dataset.messageText) {
            text = element.dataset.messageText;
        } else {
            text = element.textContent || element.innerText || '';
        }
        
        return text.trim();
    }

    extractSender(element) {
        // Try to find sender name near the message
        const senderElement = element.querySelector('[data-sender-name]') ||
                             element.querySelector('.sender-name') ||
                             element.closest('[data-participant-name]');
        
        if (senderElement) {
            return senderElement.textContent.trim();
        }
        
        return 'Unknown';
    }

    // =========================================================
    // AI Text Detection
    // =========================================================

    analyzeMessage(text) {
        const analysis = {
            isAIGenerated: false,
            confidence: 0,
            patterns: [],
            readability: 0,
            perplexity: 0
        };
        
        // Check for AI patterns
        this.aiPatterns.forEach(pattern => {
            if (pattern.test(text)) {
                analysis.patterns.push(pattern.source);
                analysis.confidence += 0.2;
            }
        });
        
        // Check text statistics
        const stats = this.calculateTextStats(text);
        
        // AI-generated text often has:
        // - Very high readability (too perfect)
        // - Consistent sentence length
        // - Lack of typos
        // - Formal structure
        
        if (stats.readability > 70) {
            analysis.confidence += 0.2;
        }
        
        if (stats.sentenceLengthStd < 5) {
            analysis.confidence += 0.2;
        }
        
        if (stats.uniqueWords / stats.totalWords < 0.4) {
            analysis.confidence += 0.1;
        }
        
        if (stats.hasTypos === false) {
            analysis.confidence += 0.1;
        }
        
        analysis.readability = stats.readability;
        analysis.perplexity = stats.perplexity;
        analysis.isAIGenerated = analysis.confidence > this.detectionThreshold;
        
        return analysis;
    }

    calculateTextStats(text) {
        const words = text.split(/\s+/).filter(w => w.length > 0);
        const sentences = text.split(/[.!?]+/).filter(s => s.length > 0);
        
        // Calculate readability (simplified Flesch-Kincaid)
        const syllables = this.countSyllables(text);
        const readability = 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length);
        
        // Calculate sentence length standard deviation
        const sentenceLengths = sentences.map(s => s.split(/\s+/).length);
        const avgLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
        const variance = sentenceLengths.reduce((a, b) => a + Math.pow(b - avgLength, 2), 0) / sentenceLengths.length;
        const stdDev = Math.sqrt(variance);
        
        // Check for typos (simplified - just check for common typos)
        const hasTypos = /(teh|adn|form|thier|recieve|seperate|occured)/i.test(text);
        
        return {
            readability: Math.min(100, Math.max(0, readability)),
            sentenceLengthStd: stdDev,
            totalWords: words.length,
            uniqueWords: new Set(words.map(w => w.toLowerCase())).size,
            hasTypos: hasTypos,
            perplexity: Math.random() * 50 + 50 // Placeholder - would use actual model
        };
    }

    countSyllables(text) {
        // Simplified syllable counter
        const words = text.toLowerCase().split(/\s+/);
        let count = 0;
        
        words.forEach(word => {
            word = word.replace(/[^a-z]/g, '');
            const matches = word.match(/[aeiouy]+/g);
            if (matches) {
                count += matches.length;
            }
        });
        
        return count;
    }

    // =========================================================
    // UI Highlighting
    // =========================================================

    highlightMessage(element, analysis) {
        // Add visual indicator to suspicious messages
        element.classList.add('dfd-suspicious-chat');
        
        // Add tooltip
        const tooltip = document.createElement('span');
        tooltip.className = 'dfd-chat-tooltip';
        tooltip.textContent = `⚠️ AI-generated (${(analysis.confidence * 100).toFixed(1)}% confidence)`;
        element.appendChild(tooltip);
        
        // Auto-remove tooltip after 5 seconds
        setTimeout(() => {
            if (tooltip.parentElement) {
                tooltip.remove();
            }
        }, 5000);
    }

    // =========================================================
    // Event Handling
    // =========================================================

    triggerChatEvent(data) {
        const event = new CustomEvent('dfd-chat-analysis', {
            detail: {
                text: data.text,
                sender: data.sender,
                isAIGenerated: data.analysis.isAIGenerated,
                confidence: data.analysis.confidence,
                patterns: data.analysis.patterns,
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
    }

    disable() {
        this.enabled = false;
    }

    // =========================================================
    // Stats
    // =========================================================

    getStats() {
        const aiMessages = this.messageHistory.filter(m => m.analysis.isAIGenerated).length;
        
        return {
            totalMessages: this.messageHistory.length,
            aiMessages: aiMessages,
            averageConfidence: this.messageHistory.reduce((acc, m) => acc + m.analysis.confidence, 0) / this.messageHistory.length || 0,
            detectedPatterns: this.getUniquePatterns()
        };
    }

    getUniquePatterns() {
        const patterns = new Set();
        this.messageHistory.forEach(m => {
            m.analysis.patterns.forEach(p => patterns.add(p));
        });
        return Array.from(patterns);
    }
}

// Export for use in content scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatDetector;
}
