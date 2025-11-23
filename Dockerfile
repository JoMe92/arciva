# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend .
RUN npm run build

FROM python:3.11-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libraw-dev \
        libjpeg-dev \
        libpng-dev \
        libtiff5-dev \
        libglib2.0-0 \
        libgl1 \
        exiftool \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend ./backend
COPY --from=frontend-builder /frontend/dist /app/frontend_dist
COPY docker/entrypoint.sh /usr/local/bin/arciva-entrypoint.sh
RUN chmod +x /usr/local/bin/arciva-entrypoint.sh \
    && mkdir -p /data/db /data/media /data/logs

ENV FRONTEND_DIST_DIR=/app/frontend_dist \
    APP_DB_PATH=/data/db/app.db \
    APP_MEDIA_ROOT=/data/media \
    LOGS_DIR=/data/logs \
    PORT=8000

EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/arciva-entrypoint.sh"]
CMD ["api"]
