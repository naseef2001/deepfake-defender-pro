// Deepfake Defender - Background Script

console.log('🔧 Deepfake Defender background script loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.tabs.create({ url: 'welcome.html' });
    }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'getSettings') {
        chrome.storage.local.get(null, (settings) => {
            sendResponse(settings);
        });
        return true;
    }
});

// Periodic health check
setInterval(() => {
    chrome.storage.local.get(['kaliIp'], (result) => {
        const ip = result.kaliIp || '192.168.152.128';
        fetch(`http://${ip}:8000/health`)
            .then(r => r.json())
            .then(data => {
                console.log('✅ Kali VM health check passed');
            })
            .catch(() => {
                console.log('❌ Kali VM health check failed');
            });
    });
}, 30000); // Check every 30 seconds
