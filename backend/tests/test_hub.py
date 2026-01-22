import pytest
import uuid
import json
from datetime import datetime
from backend.app import models


@pytest.mark.asyncio
async def test_list_hub_assets_basic(client, TestSessionLocal):
    # Setup: Create User, Project, Asset, Link
    async with TestSessionLocal() as session:
        user_id = uuid.UUID("12345678-1234-5678-1234-567812345678")
        project = models.Project(
            id=uuid.uuid4(),
            user_id=user_id,
            title="Hub Test Project",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        session.add(project)
        asset = models.Asset(
            id=uuid.uuid4(),
            user_id=user_id,
            original_filename="test_hub.jpg",
            mime="image/jpeg",
            size_bytes=1000,
            status=models.AssetStatus.READY,
            created_at=datetime.utcnow(),
            width=800,
            height=600,
        )
        session.add(asset)

        link = models.ProjectAsset(
            id=uuid.uuid4(),
            user_id=user_id,
            project_id=project.id,
            asset_id=asset.id,
            added_at=datetime.utcnow(),
        )
        session.add(link)
        await session.commit()
    # Test - Filter by project to ensure isolation
    response = await client.get(
        f"/v1/image-hub/assets?project_id={project.id}"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["assets"]) >= 1
    # Check if our asset is in the list
    asset_ids = [a["asset_id"] for a in data["assets"]]
    assert str(asset.id) in asset_ids


@pytest.mark.asyncio
async def test_list_hub_assets_filtering(client, TestSessionLocal):
    async with TestSessionLocal() as session:
        user_id = uuid.UUID("12345678-1234-5678-1234-567812345678")
        project1 = models.Project(id=uuid.uuid4(), user_id=user_id, title="P1")
        project2 = models.Project(id=uuid.uuid4(), user_id=user_id, title="P2")
        session.add_all([project1, project2])

        asset1 = models.Asset(
            id=uuid.uuid4(),
            user_id=user_id,
            original_filename="a1.jpg",
            status=models.AssetStatus.READY,
            mime="image/jpeg",
            size_bytes=100,
        )
        asset2 = models.Asset(
            id=uuid.uuid4(),
            user_id=user_id,
            original_filename="a2.jpg",
            status=models.AssetStatus.READY,
            mime="image/jpeg",
            size_bytes=100,
        )
        session.add_all([asset1, asset2])

        link1 = models.ProjectAsset(
            project_id=project1.id, asset_id=asset1.id, user_id=user_id
        )
        link2 = models.ProjectAsset(
            project_id=project2.id, asset_id=asset2.id, user_id=user_id
        )
        session.add_all([link1, link2])
        await session.flush()

        # Add metadata for filtering
        meta1 = models.MetadataState(
            link_id=link1.id, rating=5, color_label="Red"
        )
        session.add(meta1)

        await session.commit()
        p1_id = str(project1.id)

    # Filter by Project
    r = await client.get(f"/v1/image-hub/assets?project_id={p1_id}")
    assert r.status_code == 200
    data = r.json()
    # Should have at least our asset
    asset_ids = [a["asset_id"] for a in data["assets"]]
    assert str(asset1.id) in asset_ids

    # Filter by Rating
    filter_bad = json.dumps({"ratings": [5]})
    r = await client.get(f"/v1/image-hub/assets?filters={filter_bad}")
    data = r.json()
    assert len(data["assets"]) == 1
    assert data["assets"][0]["rating"] == 5

    # Both should match if logic was >= 1? No, asset2 has no rating (0)
    filter_none = json.dumps({"ratings": [1]})
    r = await client.get(f"/v1/image-hub/assets?filters={filter_none}")
    data = r.json()
    # Only asset1 (rating 5) >= 1. Asset2 is 0.
    assert len(data["assets"]) == 1

    # Filter by Label
    filter_label = json.dumps({"labels": ["Red"]})
    r = await client.get(f"/v1/image-hub/assets?filters={filter_label}")
    data = r.json()
    assert len(data["assets"]) == 1
    assert data["assets"][0]["label"] == "Red"


@pytest.mark.asyncio
async def test_list_hub_date_buckets(client, TestSessionLocal):
    # Setup test data with different dates
    async with TestSessionLocal() as session:
        user_id = uuid.UUID("12345678-1234-5678-1234-567812345678")
        proj = models.Project(
            id=uuid.uuid4(), user_id=user_id, title="Date Proj"
        )
        session.add(proj)

        # Year 2023
        d1 = datetime(2023, 5, 10)
        a1 = models.Asset(
            id=uuid.uuid4(),
            user_id=user_id,
            original_filename="2023.jpg",
            status=models.AssetStatus.READY,
            taken_at=d1,
            created_at=d1,
            mime="image/jpeg",
            size_bytes=100,
        )
        l1 = models.ProjectAsset(
            project_id=proj.id, asset_id=a1.id, user_id=user_id
        )

        # Year 2024
        d2 = datetime(2024, 1, 15)
        a2 = models.Asset(
            id=uuid.uuid4(),
            user_id=user_id,
            original_filename="2024.jpg",
            status=models.AssetStatus.READY,
            taken_at=d2,
            created_at=d2,
            mime="image/jpeg",
            size_bytes=100,
        )
        l2 = models.ProjectAsset(
            project_id=proj.id, asset_id=a2.id, user_id=user_id
        )

        session.add_all([proj, a1, a2, l1, l2])
        await session.commit()

    # Query Buckets (Year level)
    r = await client.get("/v1/image-hub/assets?mode=date&limit=0")
    assert r.status_code == 200
    data = r.json()
    buckets = data["buckets"]
    years = [b["year"] for b in buckets]
    assert 2023 in years
    assert 2024 in years

    # Drill down to 2024 (Month level)
    r = await client.get("/v1/image-hub/assets?mode=date&year=2024&limit=0")
    data = r.json()
    buckets = data["buckets"]
    months = [b["month"] for b in buckets]
    assert 1 in months  # January


@pytest.mark.asyncio
async def test_hub_pagination_distinct_ids(client, TestSessionLocal):
    """Test that pagination works on distinct Asset IDs, avoiding duplicates
    when assets belong to multiple projects."""
    unique_marker = str(uuid.uuid4())

    async with TestSessionLocal() as session:
        user_id = uuid.UUID("12345678-1234-5678-1234-567812345678")

        # Create 2 projects
        p1 = models.Project(id=uuid.uuid4(), user_id=user_id, title="P1")
        p2 = models.Project(id=uuid.uuid4(), user_id=user_id, title="P2")
        session.add_all([p1, p2])
        await session.flush()

        # Create 5 assets, link all to BOTH projects
        assets = []
        for i in range(5):
            a = models.Asset(
                id=uuid.uuid4(),
                user_id=user_id,
                # Use unique name for isolation
                original_filename=f"pagetest_{unique_marker}_{i}.jpg",
                status=models.AssetStatus.READY,
                mime="image/jpeg",
                size_bytes=100,
            )
            assets.append(a)
            session.add(a)
            await session.flush()

            # Link to P1 and P2
            l1 = models.ProjectAsset(
                project_id=p1.id, asset_id=a.id, user_id=user_id
            )
            l2 = models.ProjectAsset(
                project_id=p2.id, asset_id=a.id, user_id=user_id
            )
            session.add_all([l1, l2])

        await session.commit()

    # Request with search filter to isolate our assets
    filters = json.dumps({"search": f"pagetest_{unique_marker}"})

    # Page size 3
    r = await client.get(f"/v1/image-hub/assets?limit=3&filters={filters}")
    assert r.status_code == 200
    data = r.json()

    assert len(data["assets"]) == 3
    ids = [a["asset_id"] for a in data["assets"]]
    assert len(set(ids)) == 3

    # Next page
    cursor = data["next_cursor"]
    assert cursor is not None

    r2 = await client.get(
        f"/v1/image-hub/assets?limit=3&cursor={cursor}&filters={filters}"
    )
    data2 = r2.json()

    # Should get remaining 2
    assert len(data2["assets"]) == 2
    ids2 = [a["asset_id"] for a in data2["assets"]]

    assert set(ids).isdisjoint(set(ids2))


@pytest.mark.asyncio
async def test_hub_bucket_filtering(client, TestSessionLocal):
    """Test that filters are correctly applied to date buckets."""
    unique_marker = str(uuid.uuid4())

    async with TestSessionLocal() as session:
        user_id = uuid.UUID("12345678-1234-5678-1234-567812345678")
        p1 = models.Project(id=uuid.uuid4(), user_id=user_id, title="P1")
        session.add(p1)

        # Asset 1: 2025-01-01, Rating 5
        a1 = models.Asset(
            id=uuid.uuid4(),
            user_id=user_id,
            original_filename=f"bucktest_{unique_marker}_1.jpg",
            status=models.AssetStatus.READY,
            mime="image/jpeg",
            size_bytes=100,
            taken_at=datetime(2025, 1, 1),
        )
        l1 = models.ProjectAsset(
            project_id=p1.id, asset_id=a1.id, user_id=user_id
        )
        session.add_all([a1, l1])
        await session.flush()

        m1 = models.MetadataState(link_id=l1.id, rating=5)
        session.add(m1)

        # Asset 2: 2025-01-01, Rating 1
        a2 = models.Asset(
            id=uuid.uuid4(),
            user_id=user_id,
            original_filename=f"bucktest_{unique_marker}_2.jpg",
            status=models.AssetStatus.READY,
            mime="image/jpeg",
            size_bytes=100,
            taken_at=datetime(2025, 1, 1),
        )
        l2 = models.ProjectAsset(
            project_id=p1.id, asset_id=a2.id, user_id=user_id
        )
        session.add_all([a2, l2])
        await session.flush()

        m2 = models.MetadataState(link_id=l2.id, rating=1)
        session.add(m2)

        await session.commit()

    import json

    # 1. Filter by Rating >= 5 AND Search unique name
    filters = json.dumps(
        {"ratings": [5], "search": f"bucktest_{unique_marker}"}
    )

    r = await client.get(
        f"/v1/image-hub/assets?mode=date&limit=0&filters={filters}"
    )
    data = r.json()
    buckets = data["buckets"]

    # Should see 1 asset in 2025 bucket
    b2025 = next((b for b in buckets if b["year"] == 2025), None)
    assert b2025 is not None
    assert b2025["asset_count"] == 1

    # 2. Filter Search only (Rating ignored/all). Should see 2 assets.
    filters2 = json.dumps({"search": f"bucktest_{unique_marker}"})
    r2 = await client.get(
        f"/v1/image-hub/assets?mode=date&limit=0&filters={filters2}"
    )
    data2 = r2.json()
    buckets2 = data2["buckets"]

    b2025_2 = next((b for b in buckets2 if b["year"] == 2025), None)
    assert b2025_2 is not None
    assert b2025_2["asset_count"] == 2


@pytest.mark.asyncio
async def test_list_hub_projects(client, app, TestSessionLocal):
    # Setup: Create UNIQUE User for this test to avoid collision with
    # other tests in session DB
    from backend.app.security import get_current_user

    unique_user_id = uuid.uuid4()

    # Override the dependency for this test
    async def override_get_current_user():
        return models.User(
            id=unique_user_id,
            email=f"test_{unique_user_id}@example.com",
            password_hash="mock",
        )

    app.dependency_overrides[get_current_user] = override_get_current_user

    try:
        async with TestSessionLocal() as session:
            # Create user in DB (optional if not enforcing FK strictly,
            # but good practice)
            # Models usually enforce FK to users table
            u = models.User(
                id=unique_user_id,
                email=f"test_{unique_user_id}@example.com",
                password_hash="mock",
            )
            session.add(u)

            # Proj 1: 2 assets
            p1 = models.Project(
                id=uuid.uuid4(), user_id=unique_user_id, title="Hub Project 1"
            )
            session.add(p1)

            # Proj 2: 1 asset, updated later
            p2 = models.Project(
                id=uuid.uuid4(), user_id=unique_user_id, title="Hub Project 2"
            )
            session.add(p2)

            # Proj 3: 0 assets (should not show up)
            p3 = models.Project(
                id=uuid.uuid4(), user_id=unique_user_id, title="Empty Project"
            )
            session.add(p3)

            # Assets
            a1 = models.Asset(
                id=uuid.uuid4(),
                user_id=unique_user_id,
                mime="image/jpeg",
                status=models.AssetStatus.READY,
                size_bytes=100,
                original_filename="a1",
            )
            a2 = models.Asset(
                id=uuid.uuid4(),
                user_id=unique_user_id,
                mime="image/jpeg",
                status=models.AssetStatus.READY,
                size_bytes=100,
                original_filename="a2",
            )
            a3 = models.Asset(
                id=uuid.uuid4(),
                user_id=unique_user_id,
                mime="image/jpeg",
                status=models.AssetStatus.READY,
                size_bytes=100,
                original_filename="a3",
            )

            session.add_all([a1, a2, a3])
            await session.flush()

            # Links
            # P1 linked at T-100 and T-50
            t1 = datetime(2025, 1, 1, 10, 0, 0)  # P1 link 1
            t2 = datetime(2025, 1, 1, 12, 0, 0)  # P1 link 2

            # P2 linked at T-10 (Most recent)
            t3 = datetime(2025, 1, 2, 10, 0, 0)  # P2 link 1

            l1 = models.ProjectAsset(
                project_id=p1.id,
                asset_id=a1.id,
                user_id=unique_user_id,
                added_at=t1,
            )
            l2 = models.ProjectAsset(
                project_id=p1.id,
                asset_id=a2.id,
                user_id=unique_user_id,
                added_at=t2,
            )
            l3 = models.ProjectAsset(
                project_id=p2.id,
                asset_id=a3.id,
                user_id=unique_user_id,
                added_at=t3,
            )

            session.add_all([l1, l2, l3])
            await session.commit()

            p1_id = str(p1.id)
            p2_id = str(p2.id)

        # Test
        response = await client.get("/v1/image-hub/projects")
        assert response.status_code == 200, response.text
        data = response.json()
        projects = data["projects"]

        # Needs to match frontend schema
        # expect P2 first (latest), then P1. P3 should not be there.
        # Check lengths strictly now that we have isolation
        assert len(projects) == 2
        assert projects[0]["project_id"] == p2_id
        assert projects[0]["asset_count"] == 1

        assert projects[1]["project_id"] == p1_id
        assert projects[1]["asset_count"] == 2

        # Test Search
        response = await client.get("/v1/image-hub/projects?query=Project 1")
        data = response.json()
        assert len(data["projects"]) == 1
        assert data["projects"][0]["project_id"] == p1_id
    finally:
        # Restore dependency
        # Removing the key restores the original dependency if it was in the
        # map, or we assume clean slate. But app is session scoped, so we
        # must clean up.
        if get_current_user in app.dependency_overrides:
            del app.dependency_overrides[get_current_user]
