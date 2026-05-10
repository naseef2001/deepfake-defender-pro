#!/usr/bin/env python3
"""
GraphQL Server for Deepfake Defender Pro
Part 3.3

This server runs the GraphQL API on port 8002
"""

import os
import sys
import logging
from datetime import datetime
from pathlib import Path

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from strawberry.fastapi import GraphQLRouter
import uvicorn

from .schema import schema, get_schema_info

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# =========================================================
# Context Builder
# =========================================================

async def get_context(request: Request):
    """Context builder for GraphQL"""
    token = request.headers.get("Authorization", "")
    if token.startswith("Bearer "):
        token = token[7:]
    
    return {
        "request": request,
        "token": token
    }


# =========================================================
# GraphQL Router
# =========================================================

graphql_app = GraphQLRouter(
    schema,
    context_getter=get_context,
)


# =========================================================
# FastAPI Application
# =========================================================

app = FastAPI(
    title="Deepfake Defender GraphQL API",
    description="GraphQL interface for Deepfake Defender Pro",
    version="3.3.0"
)

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files directory
static_dir = Path("./static")
static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Mount GraphQL router
app.include_router(graphql_app, prefix="/graphql")


# =========================================================
# REST Endpoints
# =========================================================

@app.get("/")
async def root():
    """Root endpoint with GraphQL info"""
    return {
        "service": "Deepfake Defender GraphQL API",
        "version": "3.3.0",
        "graphql_endpoint": "/graphql",
        "graphiql_ide": "/graphiql",
        "static_test": "/static/test.html",
        "documentation": "Use GraphQL queries at /graphql",
        "schema_info": get_schema_info(),
        "timestamp": datetime.now().isoformat()
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "GraphQL API",
        "version": "3.3.0",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/schema-info")
async def schema_info():
    """Get schema version information"""
    return get_schema_info()


# =========================================================
# GraphiQL Interface - FIXED VERSION
# =========================================================

@app.get("/graphiql", response_class=HTMLResponse)
async def graphiql():
    """GraphiQL IDE interface"""
    # Try to serve static file if it exists
    static_file = Path("./static/graphiql.html")
    if static_file.exists():
        return FileResponse(static_file)
    
    # Fallback simple HTML page
    html_content = """<!DOCTYPE html>
<html>
<head>
    <title>Deepfake Defender GraphQL</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        h1 { color: #333; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
        button { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .result { margin-top: 20px; }
    </style>
</head>
<body>
    <h1>🔍 Deepfake Defender GraphQL API</h1>
    <p>Your GraphQL server is running on port 8002.</p>
    
    <h2>Quick Test</h2>
    <button onclick="testGraphQL()">Test Connection</button>
    <div class="result">
        <pre id="result">Click button to test connection...</pre>
    </div>

    <h2>Curl Command</h2>
    <pre>
curl -X POST http://localhost:8002/graphql \\
  -H "Content-Type: application/json" \\
  -d '{"query":"{ version }"}'
    </pre>

    <h2>Example Queries</h2>
    <h3>Get version:</h3>
    <pre>
{
  version
}
    </pre>

    <h3>Get health status:</h3>
    <pre>
{
  health {
    status
    version
    detectors {
      name
      loaded
    }
  }
}
    </pre>

    <h3>Login (get token):</h3>
    <pre>
mutation {
  login(username: "admin", password: "secret")
}
    </pre>

    <script>
        function testGraphQL() {
            document.getElementById('result').innerText = 'Testing...';
            
            fetch('/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({query: '{ version }'})
            })
            .then(response => response.json())
            .then(data => {
                document.getElementById('result').innerText = 
                    '✅ Success! Response:\n' + JSON.stringify(data, null, 2);
            })
            .catch(error => {
                document.getElementById('result').innerText = 
                    '❌ Error: ' + error;
            });
        }
    </script>
</body>
</html>
"""
    return HTMLResponse(content=html_content)


# =========================================================
# Simple Test Page
# =========================================================

@app.get("/test", response_class=HTMLResponse)
async def test_page():
    """Simple test page"""
    return HTMLResponse("""
<!DOCTYPE html>
<html>
<head>
    <title>GraphQL Test</title>
    <style>
        body { font-family: Arial; margin: 40px; }
        pre { background: #f0f0f0; padding: 10px; }
        button { padding: 10px; background: #007bff; color: white; border: none; cursor: pointer; }
    </style>
</head>
<body>
    <h1>GraphQL API Test</h1>
    <p>Server status: <strong id="status">Checking...</strong></p>
    <button onclick="testAPI()">Test API</button>
    <pre id="result"></pre>

    <script>
        async function testAPI() {
            document.getElementById('status').innerText = 'Testing...';
            try {
                const response = await fetch('/graphql', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({query: '{ version }'})
                });
                const data = await response.json();
                document.getElementById('result').innerText = 
                    JSON.stringify(data, null, 2);
                document.getElementById('status').innerText = '✅ Working';
            } catch (error) {
                document.getElementById('result').innerText = 'Error: ' + error;
                document.getElementById('status').innerText = '❌ Error';
            }
        }
        testAPI();
    </script>
</body>
</html>
    """)


# =========================================================
# Main Entry Point
# =========================================================

if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("🚀 DEEPFAKE DEFENDER GRAPHQL API v3.3.0")
    print("=" * 70)
    print(f"\n📡 GraphQL endpoint: http://localhost:8002/graphql")
    print(f"🔍 GraphiQL IDE: http://localhost:8002/graphiql")
    print(f"🧪 Test page: http://localhost:8002/test")
    print(f"📚 Health check: http://localhost:8002/health")
    print(f"📊 Schema info: http://localhost:8002/schema-info")
    print(f"📁 Static files: http://localhost:8002/static/")
    print(f"\n✅ GraphQL Schema loaded successfully")
    print(f"\n📋 Version: 3.3.0")
    print("=" * 70)
    
    uvicorn.run(
        "api.graphql.server:app",
        host="0.0.0.0",
        port=8002,
        reload=True,
        log_level="info"
    )
