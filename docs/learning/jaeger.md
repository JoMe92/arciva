# Jaeger & Distributed Tracing Tutorial

## What is Jaeger?

**Jaeger** is an open-source platform for **distributed tracing**.

In a modern application like Arciva, a single user action (like uploading a photo) triggers a chain of events across multiple services:

1. **Frontend**: Uploads the file.
2. **Backend API**: Receives the file, saves it to disk, and creates a database record.
3. **Database**: Inserts the record.
4. **Job Queue (Redis)**: Enqueues a background task.
5. **Worker**: Picks up the task, processes the image (resizing, EXIF extraction), and updates the database again.

Jaeger allows you to **visualize this entire chain** as a single "Trace", composed of multiple "Spans" (individual units of work). This helps you understand:

* **Latency**: How long did the whole request take? Which part was the slowest?
* **Errors**: Did the worker fail? Why? What was the API request that caused it?
* **Dependencies**: How many times did we query the database?

## How is it Implemented?

We use **OpenTelemetry (OTel)**, the industry standard for observability, to collect traces and send them to Jaeger.

### 1. Infrastructure

We run a **Jaeger** container (image: `jaegertracing/all-in-one`) which acts as both the collector and the UI.

* **UI Port**: `16686` (Access via browser)
* **Collector Port**: `4317` (Internal gRPC port for sending traces)

### 2. Backend (FastAPI)

The backend is instrumented using the `opentelemetry-instrumentation-fastapi` library.

* **Automatic**: Every HTTP request (`GET`, `POST`, etc.) automatically starts a trace.
* **Database**: `opentelemetry-instrumentation-sqlalchemy` automatically traces every SQL query.

### 3. Worker (Arq)

The worker is instrumented manually using a custom decorator `@trace_job`.

* **Job Tracing**: When `ingest_asset` runs, it creates a span named `ingest_asset`.
* **Linking**: We aim to link the worker trace to the API trace that triggered it (Context Propagation), giving you a full end-to-end view.

## How to Use It

### 1. Start the Stack

Ensure the stack is running. Jaeger is included in both the standard Docker setup and the dev stack.

```bash
# Production / Full Docker
docker compose -f deploy/docker-compose.arciva.yml up -d

# Development
pixi run dev-stack
```

### 2. Generate Traffic

Use the Arciva application as normal.

* Open [http://localhost:5173](http://localhost:5173) (or port 8000).
* Navigate around, upload photos, change settings.

### 3. Analyze in Jaeger

Open the Jaeger UI at **[http://localhost:16686](http://localhost:16686)**.

* **Search**:
  * Select **Service**: `arciva-backend` or `arciva-worker`.
  * Click **Find Traces**.
* **Inspect**:
  * Click on a trace to see the timeline.
  * **Spans**: Each bar represents a span. Longer bars = more time.
  * **Tags**: Click on a span to see details (SQL query, HTTP status code, error message).

## Practical Debugging Guide

### Scenario 1: "Why is the upload so slow?"

1. Find the `POST /api/uploads` trace in Jaeger.
2. Look at the timeline.
3. **Is the API span long?** Maybe writing to disk is slow.
4. **Is there a gap before the worker starts?** The queue might be backed up.
5. **Is the worker span long?** Click it.
    * Is `make_thumb` taking 5 seconds? We might need to optimize image processing.
    * Are there 50 SQL queries? We might have an N+1 query problem.

### Scenario 2: "The image is stuck in 'Processing'"

1. Find the trace for the upload.
2. Look for the `ingest_asset` span from the `arciva-worker` service.
3. **Is it missing?** The worker might be down or not picking up jobs.
4. **Is it red (Error)?** Click it.
    * Look at the **Logs** or **Tags** section in the span detail.
    * You might see `FileNotFoundError` or `DatabaseError`.
    * This tells you exactly *why* it failed, without digging through megabytes of text logs.

## FAQ

**Q: Does this run in production?**
A: Yes, but you might want to point `OTEL_EXPORTER_OTLP_ENDPOINT` to a managed service (like Honeycomb, Datadog, or a central Jaeger instance) instead of a local container for better persistence.

**Q: I don't see any traces.**
A:

1. Wait a few seconds (traces are buffered).
2. Ensure `OTEL_EXPORTER_OTLP_ENDPOINT` is set correctly (default `http://localhost:4317` for local dev, `http://jaeger:4317` for Docker).
3. Check the logs of the backend/worker for connection errors to the collector.

**Q: Can I see the SQL queries?**
A: Yes! Click on any span labeled `SELECT ...` or `INSERT ...`. The `db.statement` tag contains the full SQL query.
