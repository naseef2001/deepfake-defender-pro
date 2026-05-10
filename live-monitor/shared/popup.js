// Deepfake Defender - Popup Script
document.addEventListener('DOMContentLoaded', function() {
    updateStatus();
    document.getElementById('testBtn').addEventListener('click', testConnection);
});

async function updateStatus() {
    const statusEl = document.getElementById('status');
    statusEl.textContent = '⏳ Checking...';
    
    try {
        const response = await fetch('https://192.168.152.128:8000/health');
        const data = await response.json();
        
        if (data.status === 'healthy') {
            statusEl.innerHTML = '✅ Connected';
            statusEl.style.color = '#00ff00';
        } else {
            statusEl.innerHTML = '⚠️ Unknown';
            statusEl.style.color = '#ffaa00';
        }
    } catch (error) {
        statusEl.innerHTML = '❌ Offline';
        statusEl.style.color = '#ff4444';
    }
}

async function testConnection() {
    const btn = document.getElementById('testBtn');
    const originalText = btn.textContent;
    
    btn.textContent = 'Testing...';
    btn.disabled = true;
    
    try {
        const response = await fetch('https://192.168.152.128:8000/health');
        const data = await response.json();
        
        if (data.status === 'healthy') {
            alert(`✅ Connected to Kali VM!\n\nVersion: ${data.version}\nDetectors: ${Object.keys(data.detectors).join(', ')}`);
            updateStatus();
        } else {
            alert('⚠️ Connected but unexpected response');
        }
    } catch (error) {
        alert('❌ Cannot connect to Kali VM\n\nMake sure:\n1. Kali VM is running\n2. Servers are started\n3. HTTPS certificate is accepted');
        updateStatus();
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}
