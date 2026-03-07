FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04 AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 python3.12-venv python3-pip ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
