FROM python:3.10-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    YOLO_CONFIG_DIR=/tmp/ultralytics \
    MPLCONFIGDIR=/tmp/matplotlib

WORKDIR /ai-service

# OpenCV wheel dependencies. The service does not need a desktop environment.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
# Inference already runs on CPU; avoid bundling CUDA libraries in deployment.
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir torch==2.11.0+cpu torchvision==0.26.0+cpu --extra-index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt \
    && pip check

COPY app ./app
COPY yolo26s-pose.pt ./

RUN useradd --create-home --uid 10001 app \
    && mkdir -p data/evaluations /tmp/ultralytics /tmp/matplotlib \
    && chown -R app:app data /tmp/ultralytics /tmp/matplotlib
USER app

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)" || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
