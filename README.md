# AI Vision Dashboard

A full-stack AI detection web app — Face Detection & Object Detection — built with:
- **FastAPI** (Python backend)
- **OpenCV** (detection engine)
- **YOLOv3-tiny** (object detection)
- **WebSocket** (live webcam streaming)

---

## Project Structure

```
ai-detection-app/
├── main.py                   # FastAPI app & API routes
├── detector.py               # Detection engine (face + object)
├── requirements.txt
├── models/                   # Auto-created; place YOLO weights here
│   ├── yolov3-tiny.weights   # ← download manually (see below)
│   ├── yolov3-tiny.cfg       # ← auto-downloaded on first run
│   └── coco.names            # ← auto-downloaded on first run
├── static/
│   ├── css/style.css
│   ├── js/app.js
│   ├── uploads/              # Auto-created
│   └── results/              # Auto-created
└── templates/
    └── index.html
```

---

## Setup

### 1. Install Python dependencies
```bash
pip install -r requirements.txt
```

### 2. Download YOLOv3-tiny weights (required for Object Detection)
```bash
mkdir -p models
# Windows (PowerShell):
Invoke-WebRequest -Uri "https://pjreddie.com/media/files/yolov3-tiny.weights" -OutFile "models/yolov3-tiny.weights"

# macOS / Linux:
wget https://pjreddie.com/media/files/yolov3-tiny.weights -O models/yolov3-tiny.weights
```

> **Note:** `coco.names` and `yolov3-tiny.cfg` are auto-downloaded on first run.
> Face detection works immediately — no downloads needed.

### 3. Run the server
```bash
python main.py
```

### 4. Open in browser
```
http://localhost:8000
```

---

## Features

| Feature | Description |
|---|---|
| **Image Upload** | Upload JPG/PNG/WEBP, run face or object detection, download result |
| **Live Webcam** | Real-time detection via WebSocket streaming |
| **Class Library** | Browse all 80 COCO classes loaded dynamically from `coco.names` |
| **Confidence Slider** | Adjust detection threshold for object mode |
| **Dynamic Classes** | Drop in any `.names` file — no code changes needed |

---

## Using a Custom Model

To use your own YOLO model, update `detector.py`:

```python
engine = DetectionEngine(names_path="models/my_classes.names")
```

And point `YOLO_CFG_PATH` / `YOLO_WEIGHTS_PATH` to your model files.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Dashboard UI |
| `POST` | `/api/detect/image` | Detect from uploaded image |
| `GET` | `/api/download/{filename}` | Download result image |
| `GET` | `/api/classes` | List all loaded class names |
| `WS` | `/ws/webcam` | WebSocket for live detection |
