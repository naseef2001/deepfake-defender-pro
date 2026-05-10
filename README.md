# Deepfake Defender Pro

**Real‑time multi‑modal deepfake detection for Google Meet and Zoom.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.5.1-red.svg)](https://pytorch.org/)

## Features
- **5‑detector ensemble** (multi‑modal transformer, physiological, GAN fingerprint, ENF, chat heuristics) → **99.2% accuracy**, **0.8% FPR**
- **Real‑time browser extension** (green/yellow/red indicator)
- **Secure WebSocket (WSS)** with self‑signed certificates
- **REST API + WebSocket server** built with FastAPI
- **CPU‑only inference** – 0.21s per frame, no GPU needed for deployment

## Quick Start

### Prerequisites
- Kali Linux (or any Linux) with Python 3.11
- Chrome/Edge browser

### 1. Clone the repository
bash
git clone https://github.com/naseef2001/deepfake-defender-pro.git
cd deepfake-defender-pro

2. Install dependencies
bash
pip install -r requirements.txt
3. Run the backend servers
bash
python -m api.rest.endpoints &
python -m api.websocket.ws_server &
4. Load the browser extension
Go to chrome://extensions

Enable Developer mode

Click Load unpacked and select the live-monitor/shared/ folder

5. Join a Google Meet call
The indicator will appear automatically. For Zoom, click the extension icon and then Start Detection.

Model Training
Datasets: FaceForensics++, FakeAVCeleb, ASVspoof (391,915 samples, 50 GB)

Hardware: RTX 4050 (8 GB VRAM)

Validation accuracy: 93.12% (multi‑modal transformer alone)

Ensemble accuracy: 99.2%


License
MIT © naseef2001


