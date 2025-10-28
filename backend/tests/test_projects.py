import pytest


@pytest.mark.asyncio
async def test_create_and_fetch_project(client):
    # Create
    payload = {"title": "Demo Project", "client": "ACME", "note": "test note"}
    r = await client.post("/v1/projects", json=payload)
    assert r.status_code == 201
    created = r.json()
    assert created["title"] == payload["title"]
    assert created["client"] == payload["client"]
    assert created["note"] == payload["note"]
    assert created["asset_count"] == 0

    proj_id = created["id"]

    # List
    r = await client.get("/v1/projects")
    assert r.status_code == 200
    lst = r.json()
    assert any(p["id"] == proj_id for p in lst)

    # Get by id
    r = await client.get(f"/v1/projects/{proj_id}")
    assert r.status_code == 200
    got = r.json()
    assert got["id"] == proj_id
    assert got["asset_count"] == 0

