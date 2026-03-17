FROM python:3.10-slim-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
# PORT is injected by Railway/Render; default 8000 for local
CMD uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000}
