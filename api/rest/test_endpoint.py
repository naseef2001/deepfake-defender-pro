#!/usr/bin/env python3
"""
Simple test endpoint for Deepfake Defender API
"""

from fastapi import FastAPI, File, UploadFile, Depends, HTTPException
from fastapi.security import HTTPBearer
import uvicorn
import numpy as np
from PIL import Image
import io
import time
import hashlib
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Deepfake Defender Test API", version="1.0.0")
security = HTTPBearer()

@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/detect/image")
async def detect_image(
    file: UploadFile = File(...),
    token: str = Depends(security)
):
    """Simple image detection test"""
    try:
        # Read image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Convert to numpy
        img_array = np.array(image)
        
        # Simple "detection" (just returns image stats)
        result = {
            "filename": file.filename,
            "size": len(contents),
            "format": image.format,
            "mode": image.mode,
            "dimensions": f"{image.width}x{image.height}",
            "mean_brightness": float(np.mean(img_array)) if len(img_array.shape) == 3 else 0,
            "is_deepfake": False,  # Placeholder
            "confidence": 0.5
        }
        
        return {
            "request_id": hashlib.md5(str(time.time()).encode()).hexdigest()[:8],
            "timestamp": datetime.now().isoformat(),
            "processing_time": 0.1,
            "result": result,
            "confidence": 0.5,
            "is_deepfake": False,
            "detectors_used": ["test_detector"]
        }
        
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
