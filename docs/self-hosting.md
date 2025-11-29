# Operations Guide (Self-Hosting)

This guide covers maintenance and advanced operations for a self-hosted Arciva instance. For initial installation, see the [main README](../README.md).

## Updates

To update to a newer version of Arciva:

```bash
# 1. Pull the latest images
docker compose -f deploy/docker-compose.arciva.yml --env-file deploy/.env.arciva pull

# 2. Restart the stack
docker compose -f deploy/docker-compose.arciva.yml --env-file deploy/.env.arciva up -d
```

If you are building locally, ensure you rebuild the image (`docker build ...`) and update `ARCIVA_IMAGE` if necessary before restarting.

## Backup & Restore

### Backup

1. **Database (Postgres)**:

    ```bash
    docker compose -f deploy/docker-compose.arciva.yml exec postgres pg_dump -U ${POSTGRES_USER:-arciva} ${POSTGRES_DB:-arciva} > arciva-postgres.sql
    ```

2. **Media Files**:
    Archive the media volume or directory:

    ```bash
    # If using Docker volumes:
    docker run --rm -v arciva_media:/data busybox tar czf - /data > arciva-media.tar.gz
    
    # If using bind mounts, just tar the host directory:
    tar czf arciva-media.tar.gz /path/to/your/media
    ```

3. **Logs (Optional)**:

    ```bash
    docker run --rm -v arciva_logs:/data busybox tar czf - /data > arciva-logs.tar.gz
    ```

### Restore

1. **Database**:
    Stop the app, start the db, and restore the SQL dump:

    ```bash
    cat arciva-postgres.sql | docker compose -f deploy/docker-compose.arciva.yml exec -T postgres psql -U ${POSTGRES_USER:-arciva} ${POSTGRES_DB:-arciva}
    ```

2. **Media**:
    Extract the archive back into the volume or host directory.

## Advanced Configuration

### Data Directories

See the [README](../README.md#data-directories-sqlite--media) for details on configuring data paths and volumes.

### CORS

If you are hosting the frontend on a different domain than the API, configure `ALLOWED_ORIGINS` in your `.env.arciva`:

```env
ALLOWED_ORIGINS=["https://your-frontend.com"]
```
