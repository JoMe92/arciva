# Learning: Async Workers & Background Jobs

Arciva uses a "Worker" process to handle heavy tasks in the background, keeping the API fast and responsive.

## The Problem

When a user uploads a 50MB RAW photo, we need to:

1. Calculate its SHA256 hash (for deduplication).
2. Extract EXIF metadata.
3. Generate multiple thumbnails (256px, 1024px).

If we did this in the API request, the user would wait 10+ seconds for a response.

## The Solution: Arq & Redis

We use **Arq**, a job queue built on **Redis**.

1. **API (Producer)**: Receives the file, saves it to a temp location, and *enqueues* a job.

    ```python
    # backend/app/routers/uploads.py
    await redis.enqueue_job("ingest_asset", asset_id=str(asset.id))
    ```

    This takes milliseconds. The user gets an immediate "202 Accepted".

2. **Redis (Broker)**: Holds the job in a list until a worker is free.

3. **Worker (Consumer)**: A separate process (running `backend/worker/worker.py`) picks up the job and executes it.

## Worker Implementation

The worker code lives in `backend/worker/worker.py`.

```python
async def ingest_asset(ctx, asset_id: str):
    # 1. Load asset from DB
    # 2. Calculate Hash
    # 3. Generate Thumbnails
    # 4. Update DB status to 'READY'
```

### Key Concepts

* **Concurrency**: The worker can process multiple jobs at once (controlled by `WORKER_CONCURRENCY`).
* **Retries**: If a job fails (e.g., network blip), Arq can automatically retry it.
* **Idempotency**: Jobs should be safe to run multiple times. We check the asset status at the start to ensure we don't re-process a completed asset.

## Monitoring

You can monitor the worker using **Jaeger** (see [Distributed Tracing](./jaeger.md)) or by checking the logs (`logs/worker.out.log`).
