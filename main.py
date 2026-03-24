import os
import uuid
import shutil
import cv2
import json
from pathlib import Path

# Base directory of this file so relative paths always resolve correctly
BASE_DIR = Path(__file__).resolve().parent

from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect, Form, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request

from detector import DetectionEngine

# ── App Setup ─────────────────────────────────────────────────────────────────
app = FastAPI(title="AI Vision Dashboard", version="2.0")

os.makedirs(BASE_DIR / "static" / "uploads", exist_ok=True)
os.makedirs(BASE_DIR / "static" / "results", exist_ok=True)

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# Single shared engine instance
engine = DetectionEngine()


# ── Pages ─────────────────────────────────────────────────────────────────────

@app.get("/")
async def dashboard(request: Request):
    return templates.TemplateResponse(request, "index.html")

@app.get("/classic")
async def dashboard_classic(request: Request):
    """Emergency Kill Switch Route to load the stable backup UI"""
    return templates.TemplateResponse(request, "index_backup.html")


# ── REST: Image Detection ─────────────────────────────────────────────────────

@app.post("/api/detect/image")
async def detect_image(
    file: UploadFile = File(...),
    mode: str = Form("face"),
    confidence: float = Form(0.4)
):
    # Validate file type
    if not file.content_type.startswith("image/"):
        return JSONResponse({"error": "Only image files are accepted."}, status_code=400)

    # Save upload
    ext      = os.path.splitext(file.filename)[1] or ".jpg"
    uid      = uuid.uuid4().hex
    upload_path = str(BASE_DIR / "static" / "uploads" / f"{uid}{ext}")

    with open(upload_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    image = cv2.imread(upload_path)
    if image is None:
        os.remove(upload_path)
        return JSONResponse({"error": "Could not read image."}, status_code=400)

    # Run detection
    result = engine.detect(image, mode=mode, confidence_threshold=confidence)

    # Save annotated result
    result_path = str(BASE_DIR / "static" / "results" / f"result_{uid}{ext}")
    cv2.imwrite(result_path, result["image"])

    response = {
        "status":       "success",
        "mode":         mode,
        "count":        result["count"],
        "detections":   result["detections"],
        "result_url":   f"/static/results/result_{uid}{ext}",
        "download_name": f"result_{uid}{ext}",
    }
    if "error" in result:
        response["warning"] = result["error"]

    return response


# ── REST: Download Result ─────────────────────────────────────────────────────

@app.get("/api/download/{filename}")
async def download_result(filename: str):
    path = str(BASE_DIR / "static" / "results" / filename)
    if not os.path.exists(path):
        return JSONResponse({"error": "File not found."}, status_code=404)
    return FileResponse(
        path,
        media_type="image/jpeg",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ── REST: Available Classes ───────────────────────────────────────────────────

@app.get("/api/classes")
async def get_classes():
    """Return the list of all loaded object-detection class names."""
    return {
        "count":   len(engine.get_available_classes()),
        "classes": engine.get_available_classes()
    }


# ── WebSocket: Live Webcam Detection ─────────────────────────────────────────

@app.websocket("/ws/webcam")
async def webcam_ws(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            raw     = await websocket.receive_text()
            payload = json.loads(raw)
            mode    = payload.get("mode", "face")
            conf    = float(payload.get("confidence", 0.4))
            frame   = engine.base64_to_frame(payload.get("frame", ""))

            result  = engine.detect(frame, mode=mode, confidence_threshold=conf)

            await websocket.send_text(json.dumps({
                "frame":      engine.frame_to_base64(result["image"]),
                "count":      result["count"],
                "detections": result["detections"],
                "mode":       result["mode"],
            }))

    except WebSocketDisconnect:
        print("[INFO] WebSocket client disconnected.")
    except Exception as e:
        print(f"[ERROR] WebSocket error: {e}")


# ── Entry Point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"\n🚀  AI Vision Dashboard running at: http://localhost:{port}\n")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
