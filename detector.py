import cv2
import numpy as np
import base64
import os
import time
import urllib.request
from pathlib import Path

_BASE_DIR = Path(__file__).resolve().parent


class DetectionEngine:
    """
    Unified detection engine supporting:
      - Face detection   (Haar Cascade — built into OpenCV)
      - Object detection (YOLOv3-tiny  — auto-downloads labels)
    """

    COCO_NAMES_URL    = "https://raw.githubusercontent.com/pjreddie/darknet/master/data/coco.names"
    YOLO_CFG_URL      = "https://raw.githubusercontent.com/pjreddie/darknet/master/cfg/yolov3-tiny.cfg"
    MODELS_DIR        = str(_BASE_DIR / "models")
    COCO_NAMES_PATH   = str(_BASE_DIR / "models" / "coco.names")
    YOLO_CFG_PATH     = str(_BASE_DIR / "models" / "yolov3-tiny.cfg")
    YOLO_WEIGHTS_PATH = str(_BASE_DIR / "models" / "yolov3-tiny.weights")

    def __init__(self, names_path: str = None):
        os.makedirs(self.MODELS_DIR, exist_ok=True)

        # Face detector (built into OpenCV — no download needed)
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )

        # Object detector (YOLOv3-tiny)
        self.object_net   = self._load_object_net()
        labels_path       = names_path or self.COCO_NAMES_PATH
        self.coco_classes = self._load_classes(labels_path, self.COCO_NAMES_URL)

        # Unique color per class — seeded for consistency
        np.random.seed(42)
        self.colors = np.random.randint(0, 255, size=(max(len(self.coco_classes), 1), 3))

    # ── Loaders ───────────────────────────────────────────────────────────────

    def _load_classes(self, path: str, url: str) -> list:
        """Load class labels from file; auto-download if missing."""
        if not os.path.exists(path):
            print(f"[INFO] Downloading class labels → {path}")
            try:
                urllib.request.urlretrieve(url, path)
                print(f"[INFO] Downloaded: {path}")
            except Exception as e:
                raise RuntimeError(f"Could not download class labels: {e}")

        with open(path, "r") as f:
            classes = [line.strip() for line in f if line.strip()]

        print(f"[INFO] Loaded {len(classes)} classes from '{path}'")
        return classes

    def _load_object_net(self):
        """Load YOLOv3-tiny if weights exist; return None otherwise."""
        if not os.path.exists(self.YOLO_WEIGHTS_PATH):
            print("[WARN] YOLOv3-tiny weights not found. Object detection disabled.")
            print(f"       Download weights to: {self.YOLO_WEIGHTS_PATH}")
            print("       URL: https://pjreddie.com/media/files/yolov3-tiny.weights")
            return None

        if not os.path.exists(self.YOLO_CFG_PATH):
            print(f"[INFO] Downloading YOLOv3 config → {self.YOLO_CFG_PATH}")
            urllib.request.urlretrieve(self.YOLO_CFG_URL, self.YOLO_CFG_PATH)

        net = cv2.dnn.readNetFromDarknet(self.YOLO_CFG_PATH, self.YOLO_WEIGHTS_PATH)
        net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
        print("[INFO] YOLOv3-tiny loaded successfully.")
        return net

    # ── Public API ────────────────────────────────────────────────────────────

    def detect(self, image: np.ndarray, mode: str = "face",
               confidence_threshold: float = 0.4) -> dict:
        """
        Run detection on a BGR image.
        Returns: { image, count, detections, mode, time_ms }
        """
        start = time.perf_counter()
        
        if mode == "face":
            res = self._detect_faces(image)
        elif mode == "object":
            if self.object_net is None:
                res = {
                    "image": image, "count": 0, "detections": [],
                    "mode": "object",
                    "error": "YOLOv3 weights not found. See server logs."
                }
            else:
                res = self._detect_objects(image, confidence_threshold)
        else:
            raise ValueError(f"Unknown mode: {mode}")

        res["time_ms"] = round((time.perf_counter() - start) * 1000, 2)
        return res

    # ── Face Detection ────────────────────────────────────────────────────────

    def _detect_faces(self, image: np.ndarray) -> dict:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40)
        )

        result = image.copy()
        detections = []

        for (x, y, w, h) in faces:
            cv2.rectangle(result, (x, y), (x + w, y + h), (72, 199, 142), 2)
            cv2.putText(result, "Face", (x, y - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (72, 199, 142), 2)
            detections.append({
                "label": "Face", "confidence": None,
                "x": int(x), "y": int(y), "w": int(w), "h": int(h)
            })

        cv2.putText(result, f"Faces: {len(faces)}", (10, 36),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)

        return {"image": result, "count": len(faces),
                "detections": detections, "mode": "face"}

    # ── Object Detection ──────────────────────────────────────────────────────

    def _detect_objects(self, image: np.ndarray,
                        confidence_threshold: float) -> dict:
        h, w = image.shape[:2]
        blob = cv2.dnn.blobFromImage(
            image, 1 / 255.0, (416, 416), swapRB=True, crop=False
        )
        self.object_net.setInput(blob)

        layer_names   = self.object_net.getLayerNames()
        output_layers = [layer_names[i - 1]
                         for i in self.object_net.getUnconnectedOutLayers()]
        outputs = self.object_net.forward(output_layers)

        boxes, confidences, class_ids = [], [], []

        for output in outputs:
            for det in output:
                scores     = det[5:]
                class_id   = int(np.argmax(scores))
                confidence = float(scores[class_id])
                if confidence > confidence_threshold:
                    cx, cy = int(det[0] * w), int(det[1] * h)
                    bw, bh = int(det[2] * w), int(det[3] * h)
                    boxes.append([cx - bw // 2, cy - bh // 2, bw, bh])
                    confidences.append(confidence)
                    class_ids.append(class_id)

        indices = cv2.dnn.NMSBoxes(boxes, confidences, confidence_threshold, 0.3)
        result  = image.copy()
        detections = []

        if len(indices) > 0:
            for i in indices.flatten():
                x, y, bw, bh = boxes[i]
                cid   = class_ids[i]
                label = self.coco_classes[cid] if cid < len(self.coco_classes) else f"class_{cid}"
                conf  = confidences[i]
                color = [int(c) for c in self.colors[cid % len(self.colors)]]

                cv2.rectangle(result, (x, y), (x + bw, y + bh), color, 2)
                cv2.putText(result, f"{label} {conf:.0%}",
                            (x, y - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
                detections.append({
                    "label": label, "confidence": round(conf, 2),
                    "x": x, "y": y, "w": bw, "h": bh
                })

        count = len(indices) if len(indices) > 0 else 0
        cv2.putText(result, f"Objects: {count}", (10, 36),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)

        return {"image": result, "count": count,
                "detections": detections, "mode": "object"}

    # ── Utilities ─────────────────────────────────────────────────────────────

    def frame_to_base64(self, frame: np.ndarray) -> str:
        _, buf = cv2.imencode(".jpg", frame)
        return base64.b64encode(buf).decode("utf-8")

    def base64_to_frame(self, data: str) -> np.ndarray:
        if "," in data:
            data = data.split(",")[1]
        arr = np.frombuffer(base64.b64decode(data), np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)

    def get_available_classes(self) -> list:
        """Return all loaded class names (useful for frontend dropdowns)."""
        return self.coco_classes
