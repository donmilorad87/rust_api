# Geo Galleries Documentation

This document provides comprehensive documentation for the Geo Galleries feature, including location-based image galleries, geo places (admin-managed locations), and photo competitions.

---

## Overview

The Geo Galleries feature enables users to create location-based image galleries that can be displayed on a map. It includes:

- **Geo Galleries** - User-created galleries with coordinates that appear on a map
- **Geo Places** - Admin-managed locations (restaurants, cafes, lodging) for map context
- **Competitions** - Photo contests where users submit geo galleries for public voting and admin judging

---

## Database Schema

### 1. Galleries Table (Extended)

The existing `galleries` table is extended with geo-related fields:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Auto-increment ID |
| user_id | BIGINT | FK to users | Gallery owner |
| name | VARCHAR(255) | NOT NULL | Gallery name |
| description | TEXT | | Optional description |
| is_public | BOOLEAN | DEFAULT false | Public visibility |
| **gallery_type** | VARCHAR(32) | NOT NULL, CHECK | `regular_galleries` or `geo_galleries` |
| **gallery_uuid** | UUID | NOT NULL, UNIQUE | Public identifier for URLs |
| display_order | INTEGER | DEFAULT 0 | Sort order |
| **latitude** | DOUBLE PRECISION | CHECK -90 to 90 | Gallery location latitude |
| **longitude** | DOUBLE PRECISION | CHECK -180 to 180 | Gallery location longitude |
| **tags** | TEXT[] | | Array of tags for filtering |
| **cover_image_id** | BIGINT | FK to uploads | Required cover image for geo galleries |
| **cover_image_uuid** | UUID | | Cover image UUID for URL generation |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

**Gallery Type Values:**
- `regular_galleries` - Standard galleries without map display
- `geo_galleries` - Location-based galleries with coordinates (requires latitude, longitude, cover_image)

**Indexes:**
- `idx_galleries_gallery_type` - For type filtering
- `idx_galleries_geo` - Composite (latitude, longitude) for map queries
- `idx_galleries_tags` - GIN index for tag searches
- `idx_galleries_gallery_uuid` - For UUID lookups

---

### 2. Pictures Table (Extended)

Pictures can have optional per-image coordinates:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| **latitude** | DOUBLE PRECISION | CHECK -90 to 90 | Optional picture location |
| **longitude** | DOUBLE PRECISION | CHECK -180 to 180 | Optional picture location |

---

### 3. Gallery Likes Table

User engagement through likes/votes:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Auto-increment ID |
| gallery_id | BIGINT | FK to galleries, ON DELETE CASCADE | Liked gallery |
| user_id | BIGINT | FK to users, ON DELETE CASCADE | User who liked |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Like timestamp |

**Constraints:**
- `uq_gallery_like` - UNIQUE (gallery_id, user_id) - One like per user per gallery

---

### 4. Geo Places Table

Admin-managed locations for map context:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Auto-increment ID |
| name | VARCHAR(255) | NOT NULL | Place name |
| place_type | VARCHAR(20) | NOT NULL, CHECK | `restaurant`, `cafe`, or `lodging` |
| description | TEXT | | Optional description |
| latitude | DOUBLE PRECISION | NOT NULL, CHECK -90 to 90 | Location latitude |
| longitude | DOUBLE PRECISION | NOT NULL, CHECK -180 to 180 | Location longitude |
| created_by | BIGINT | FK to users, ON DELETE SET NULL | Admin who created |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

**Place Types:**
- `restaurant` - Dining establishments
- `cafe` - Coffee shops and cafes
- `lodging` - Hotels, hostels, accommodations

---

### 5. Geo Place Images Table

Images attached to geo places:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Auto-increment ID |
| place_id | BIGINT | FK to geo_places, ON DELETE CASCADE | Parent place |
| upload_id | BIGINT | FK to uploads, ON DELETE CASCADE | Image upload |
| title | VARCHAR(255) | | Optional image title |
| description | TEXT | | Optional description |
| tag | VARCHAR(100) | | Single tag for categorization |
| latitude | DOUBLE PRECISION | | Image-specific latitude |
| longitude | DOUBLE PRECISION | | Image-specific longitude |
| created_by | BIGINT | FK to users, ON DELETE SET NULL | Admin who added |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

**Constraints:**
- `uq_geo_place_images_place_upload` - UNIQUE (place_id, upload_id) - No duplicate images

---

### 6. Competitions Table

Photo contests with dates and prizes:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Auto-increment ID |
| title | VARCHAR(255) | NOT NULL | Competition title |
| description | TEXT | NOT NULL | Competition description |
| start_date | TIMESTAMPTZ | NOT NULL | Competition start |
| end_date | TIMESTAMPTZ | NOT NULL | Competition end |
| prize_cents | BIGINT | DEFAULT 10000, CHECK >= 0 | Prize amount in cents |
| rules | TEXT | NOT NULL | Competition rules |
| created_by | BIGINT | FK to users, ON DELETE SET NULL | Admin who created |
| winner_gallery_id | BIGINT | FK to galleries, ON DELETE SET NULL | Winning gallery |
| winner_user_id | BIGINT | FK to users, ON DELETE SET NULL | Winner user |
| awarded_at | TIMESTAMPTZ | | When prize was awarded |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

**Constraints:**
- `chk_competitions_dates` - CHECK (start_date < end_date)

---

### 7. Competition Entries Table

User submissions to competitions:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Auto-increment ID |
| competition_id | BIGINT | FK to competitions, ON DELETE CASCADE | Competition |
| gallery_id | BIGINT | FK to galleries, ON DELETE CASCADE | Submitted gallery |
| user_id | BIGINT | FK to users, ON DELETE CASCADE | User who submitted |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Submission timestamp |

**Constraints:**
- `uq_competition_gallery` - UNIQUE (competition_id, gallery_id) - One entry per gallery

---

### 8. Competition Admin Votes Table

Admin scoring for competition entries:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Auto-increment ID |
| competition_id | BIGINT | FK to competitions, ON DELETE CASCADE | Competition |
| gallery_id | BIGINT | FK to galleries, ON DELETE CASCADE | Voted gallery |
| admin_id | BIGINT | FK to users, ON DELETE CASCADE | Admin who voted |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Vote timestamp |

**Constraints:**
- `uq_competition_admin_vote` - UNIQUE (competition_id, gallery_id, admin_id) - One vote per admin per gallery

---

## API Endpoints

### Gallery Routes (Protected - JWT Required)

Base path: `/api/v1/galleries`

#### List User's Galleries

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/galleries` |
| **Named Route** | `galleries.list` |
| **Auth Required** | Yes (JWT) |

**Success Response (200 OK):**
```json
{
    "galleries": [
        {
            "id": 1,
            "user_id": 123,
            "name": "My Geo Gallery",
            "description": "Photos from my trip",
            "is_public": true,
            "gallery_type": "geo_galleries",
            "display_order": 0,
            "picture_count": 15,
            "latitude": 40.7128,
            "longitude": -74.0060,
            "tags": ["travel", "city"],
            "cover_image_id": 456,
            "cover_image_url": "/api/v1/upload/download/public/abc123-...",
            "created_at": "2026-01-15T10:30:00Z",
            "updated_at": "2026-01-15T10:30:00Z"
        }
    ]
}
```

---

#### Create Gallery

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/galleries` |
| **Named Route** | `galleries.create` |
| **Auth Required** | Yes (JWT) |

**Request Body:**
```json
{
    "name": "My Geo Gallery",
    "description": "Photos from my trip",
    "is_public": true,
    "gallery_type": "geo_galleries",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "tags": ["travel", "city"],
    "cover_image_id": 456
}
```

**Validation Rules:**
- `name` - Required, non-empty, unique per user
- `gallery_type` - Optional (`regular_galleries` or `geo_galleries`), auto-detected from coords
- `latitude` and `longitude` - Must be provided together
- For `geo_galleries`: latitude, longitude, and cover_image_id are required
- `cover_image_id` - Must be a public upload owned by the user

**Success Response (201 Created):**
```json
{
    "id": 1,
    "user_id": 123,
    "name": "My Geo Gallery",
    ...
}
```

**Error Responses:**
- `400 Bad Request` - Validation errors
- `409 Conflict` - Gallery name already exists

---

#### Get Gallery

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/galleries/{id}` |
| **Named Route** | `galleries.show` |
| **Auth Required** | Yes (JWT) |

**Access Control:**
- User can access their own galleries
- User can access public galleries from other users
- `403 Forbidden` for private galleries owned by others

---

#### Update Gallery

| Property | Value |
|----------|-------|
| **Route** | `PUT /api/v1/galleries/{id}` |
| **Named Route** | `galleries.update` |
| **Auth Required** | Yes (JWT) |

**Request Body (all fields optional):**
```json
{
    "name": "Updated Name",
    "description": "Updated description",
    "is_public": true,
    "gallery_type": "geo_galleries",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "tags": ["updated", "tags"],
    "cover_image_id": 789
}
```

**Access Control:**
- Only gallery owner can update

---

#### Delete Gallery

| Property | Value |
|----------|-------|
| **Route** | `DELETE /api/v1/galleries/{id}` |
| **Named Route** | `galleries.delete` |
| **Auth Required** | Yes (JWT) |

**Cascade Behavior:**
- Deletes all pictures in the gallery

---

#### Like Gallery

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/galleries/{id}/likes` |
| **Named Route** | `galleries.likes` |
| **Auth Required** | Yes (JWT) |

**Success Response (201 Created):**
```json
{
    "message": "Gallery liked"
}
```

**Error Response (409 Conflict):**
```json
{
    "error": "Already liked"
}
```

---

#### Unlike Gallery

| Property | Value |
|----------|-------|
| **Route** | `DELETE /api/v1/galleries/{id}/likes` |
| **Named Route** | `galleries.likes` |
| **Auth Required** | Yes (JWT) |

---

### Geo Gallery Routes (Protected - JWT Required)

Base path: `/api/v1/geo-galleries`

#### List Geo Galleries for Map

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/geo-galleries` |
| **Named Route** | `geo_galleries.list` |
| **Auth Required** | Yes (JWT) |

Returns all geo galleries with coordinates for map display.

**Success Response (200 OK):**
```json
{
    "galleries": [
        {
            "id": 1,
            "gallery_uuid": "550e8400-e29b-41d4-a716-446655440000",
            "title": "New York Trip",
            "description": "Photos from NYC",
            "latitude": 40.7128,
            "longitude": -74.0060,
            "tags": ["travel", "city"],
            "cover_image_url": "/api/v1/upload/download/public/abc123-...",
            "picture_count": 15
        }
    ]
}
```

---

#### Get Geo Gallery by UUID

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/geo-galleries/{gallery_uuid}` |
| **Named Route** | `geo_galleries.show` |
| **Auth Required** | Yes (JWT) |

**Success Response (200 OK):**
```json
{
    "id": 1,
    "gallery_uuid": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": 123,
    "name": "New York Trip",
    "description": "Photos from NYC",
    "is_public": true,
    "gallery_type": "geo_galleries",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "tags": ["travel", "city"],
    "cover_image_url": "/api/v1/upload/download/public/abc123-...",
    "picture_count": 15,
    "created_at": "2026-01-15T10:30:00Z",
    "updated_at": "2026-01-15T10:30:00Z",
    "is_owner": false
}
```

---

### Geo Places Routes (Mixed Auth)

Base path: `/api/v1/geo-places`

#### List Geo Places (Public)

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/geo-places` |
| **Named Route** | `geo_places.list` |
| **Auth Required** | No |

**Query Parameters:**
- `place_type` - Optional filter: `restaurant`, `cafe`, or `lodging`

**Success Response (200 OK):**
```json
{
    "places": [
        {
            "id": 1,
            "name": "Central Cafe",
            "place_type": "cafe",
            "description": "Great coffee downtown",
            "latitude": 40.7128,
            "longitude": -74.0060,
            "created_at": "2026-01-15T10:30:00Z",
            "image_count": 5
        }
    ]
}
```

---

#### List Place Images (Public)

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/geo-places/{id}/images` |
| **Auth Required** | No |

**Success Response (200 OK):**
```json
{
    "images": [
        {
            "id": 1,
            "place_id": 1,
            "url": "/api/v1/upload/download/public/abc123-...",
            "title": "Interior",
            "description": "Main seating area",
            "tag": "interior",
            "latitude": 40.7128,
            "longitude": -74.0060,
            "created_at": "2026-01-15T10:30:00Z"
        }
    ]
}
```

---

#### Admin: List All Places

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/admin/geo-places` |
| **Named Route** | `geo_places.admin` |
| **Auth Required** | Yes (JWT) |
| **Permission Required** | Admin (>= 10) |

---

#### Admin: Create Place

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/admin/geo-places` |
| **Auth Required** | Yes (JWT) |
| **Permission Required** | Admin (>= 10) |

**Request Body:**
```json
{
    "name": "Central Cafe",
    "place_type": "cafe",
    "description": "Great coffee downtown",
    "latitude": 40.7128,
    "longitude": -74.0060
}
```

**Validation Rules:**
- `name` - Required, non-empty
- `place_type` - Required, must be `restaurant`, `cafe`, or `lodging`
- `latitude` - Required, between -90 and 90
- `longitude` - Required, between -180 and 180

**Success Response (201 Created):**
```json
{
    "id": 1
}
```

---

#### Admin: Add Place Image

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/admin/geo-places/{id}/images` |
| **Auth Required** | Yes (JWT) |
| **Permission Required** | Admin (>= 10) |

**Request Body:**
```json
{
    "upload_id": 456,
    "title": "Interior",
    "description": "Main seating area",
    "tag": "interior",
    "latitude": 40.7128,
    "longitude": -74.0060
}
```

**Validation Rules:**
- `upload_id` - Required, must be a public upload owned by the admin
- `latitude` and `longitude` - Required for place images

---

### Competition Routes (Mixed Auth)

Base path: `/api/v1/competitions`

#### List Competitions (Public)

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/competitions` |
| **Named Route** | `competitions.list` |
| **Auth Required** | No |

**Success Response (200 OK):**
```json
{
    "competitions": [
        {
            "id": 1,
            "title": "Summer Photo Contest",
            "description": "Share your best summer photos",
            "start_date": "2026-06-01T00:00:00Z",
            "end_date": "2026-08-31T23:59:59Z",
            "prize_cents": 10000,
            "rules": "All photos must be original...",
            "status": "active",
            "winner_gallery_id": null,
            "winner_user_id": null,
            "awarded_at": null
        }
    ]
}
```

**Status Values:**
- `upcoming` - Competition hasn't started yet
- `active` - Competition is currently running
- `ended` - Competition has ended (may not be finalized yet)

---

#### Get Competition with Entries (Public)

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/competitions/{id}` |
| **Named Route** | `competitions.show` |
| **Auth Required** | No |

**Success Response (200 OK):**
```json
{
    "competition": {
        "id": 1,
        "title": "Summer Photo Contest",
        "description": "Share your best summer photos",
        "start_date": "2026-06-01T00:00:00Z",
        "end_date": "2026-08-31T23:59:59Z",
        "prize_cents": 10000,
        "rules": "All photos must be original...",
        "status": "active",
        "winner_gallery_id": null,
        "winner_user_id": null,
        "awarded_at": null
    },
    "entries": [
        {
            "gallery_id": 10,
            "user_id": 123,
            "likes_count": 50,
            "admin_votes_count": 3,
            "score": 0.75
        }
    ]
}
```

---

#### Admin: Create Competition

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/competitions` |
| **Named Route** | `competitions.create` |
| **Auth Required** | Yes (JWT) |
| **Permission Required** | Admin (>= 10) |

**Request Body:**
```json
{
    "title": "Summer Photo Contest",
    "description": "Share your best summer photos",
    "start_date": "2026-06-01T00:00:00Z",
    "end_date": "2026-08-31T23:59:59Z",
    "rules": "All photos must be original..."
}
```

**Validation Rules:**
- `title` - Required, non-empty
- `start_date` and `end_date` - Required, RFC3339 format, start must be before end
- Prize is automatically set to 10000 cents ($100)

---

#### Join Competition (User)

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/competitions/{id}/entries` |
| **Named Route** | `competitions.entries.create` |
| **Auth Required** | Yes (JWT) |

**Request Body:**
```json
{
    "gallery_id": 10
}
```

**Validation Rules:**
- Competition must be active (between start and end dates)
- Competition must not be finalized
- Gallery must belong to the authenticated user
- Gallery must be public
- Gallery must be a `geo_galleries` type
- Gallery must have latitude and longitude set
- Gallery cannot already be submitted to this competition

**Success Response (201 Created):**
```json
{
    "id": 1
}
```

**Error Responses:**
- `400 Bad Request` - Competition not active, gallery not public, not a geo gallery
- `404 Not Found` - Competition or gallery not found
- `409 Conflict` - Gallery already submitted

---

#### Admin: Cast Vote

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/competitions/{id}/admin-votes` |
| **Named Route** | `competitions.admin_vote` |
| **Auth Required** | Yes (JWT) |
| **Permission Required** | Admin (>= 10) |

**Request Body:**
```json
{
    "gallery_id": 10
}
```

**Validation Rules:**
- Competition must be active
- Competition must not be finalized
- Gallery must be submitted to the competition
- Admin cannot vote twice for the same gallery in the same competition

---

#### Admin: Finalize Competition

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/competitions/{id}/finalize` |
| **Named Route** | `competitions.finalize` |
| **Auth Required** | Yes (JWT) |
| **Permission Required** | Admin (>= 10) |

**Validation Rules:**
- Competition end date must have passed
- Competition must not already be finalized
- Competition must have at least one entry

**Success Response (200 OK):**
```json
{
    "winner_gallery_id": 10,
    "winner_user_id": 123,
    "score": 0.85,
    "likes_count": 50,
    "admin_votes_count": 5
}
```

---

## Scoring System

Competitions use a combined scoring system:

### Score Calculation

```
Score = (likes_score * 0.5) + (admin_score * 0.5)
```

Where:
- `likes_score` = entry_likes / max_likes (normalized to 0-1)
- `admin_score` = entry_admin_votes / max_admin_votes (normalized to 0-1)

### Tiebreaker Rules

When scores are equal:
1. Higher likes count wins
2. If likes are equal, higher admin votes count wins
3. If still tied, earlier entry wins (first to submit)

### Prize Distribution

- Prize is stored in `prize_cents` (default: 10000 = $100)
- On finalization, prize is added to winner's balance
- Winner is recorded in `winner_gallery_id` and `winner_user_id`
- Award timestamp stored in `awarded_at`

---

## Workflows

### Create a Geo Gallery

1. **Upload cover image** - `POST /api/v1/upload/public`
2. **Create gallery** - `POST /api/v1/galleries` with:
   - `gallery_type: "geo_galleries"`
   - `latitude` and `longitude`
   - `cover_image_id` from step 1
3. **Add pictures** - `POST /api/v1/galleries/{id}/pictures`
4. **Make public** (if desired) - `PUT /api/v1/galleries/{id}` with `is_public: true`

### Join a Competition

1. **Have a geo gallery** - Must be public with coordinates and cover image
2. **Check active competitions** - `GET /api/v1/competitions`
3. **Submit entry** - `POST /api/v1/competitions/{id}/entries` with gallery_id

### Admin: Run a Competition

1. **Create competition** - `POST /api/v1/competitions` with dates and rules
2. **Monitor entries** - `GET /api/v1/competitions/{id}` to see submissions
3. **Cast votes** - `POST /api/v1/competitions/{id}/admin-votes` for entries
4. **Wait for end date** - Competition must end before finalization
5. **Finalize** - `POST /api/v1/competitions/{id}/finalize` to award winner

---

## Access Control Summary

| Action | Minimum Permission |
|--------|-------------------|
| View public galleries | None |
| View public geo places | None |
| View competitions | None |
| Create/edit own galleries | Authenticated (1) |
| Like galleries | Authenticated (1) |
| Join competitions | Authenticated (1) |
| Create/edit geo places | Admin (10) |
| Create competitions | Admin (10) |
| Cast admin votes | Admin (10) |
| Finalize competitions | Admin (10) |

---

## Key Files

### Controllers
- `/home/milner/Desktop/rust/blazing_sun/src/app/http/api/controllers/gallery.rs` - Gallery CRUD
- `/home/milner/Desktop/rust/blazing_sun/src/app/http/api/controllers/gallery_like.rs` - Like/unlike
- `/home/milner/Desktop/rust/blazing_sun/src/app/http/api/controllers/geo_place.rs` - Geo places
- `/home/milner/Desktop/rust/blazing_sun/src/app/http/api/controllers/competitions.rs` - Competitions

### Database Queries
- `/home/milner/Desktop/rust/blazing_sun/src/app/db_query/read/gallery/mod.rs` - Gallery reads
- `/home/milner/Desktop/rust/blazing_sun/src/app/db_query/read/geo_place/mod.rs` - Geo place reads
- `/home/milner/Desktop/rust/blazing_sun/src/app/db_query/read/competition/mod.rs` - Competition reads
- `/home/milner/Desktop/rust/blazing_sun/src/app/db_query/mutations/gallery/mod.rs` - Gallery mutations
- `/home/milner/Desktop/rust/blazing_sun/src/app/db_query/mutations/geo_place/mod.rs` - Geo place mutations
- `/home/milner/Desktop/rust/blazing_sun/src/app/db_query/mutations/competition/mod.rs` - Competition mutations

### Migrations
- `20260111120000_add_geo_fields_to_galleries_and_pictures.sql`
- `20260111120500_add_gallery_type_to_galleries.sql`
- `20260111121000_create_geo_places.sql`
- `20260111121500_create_geo_place_images.sql`
- `20260111122000_create_competitions_and_votes.sql`
- `20260111123000_add_gallery_uuid_to_galleries.sql`

### Routes
- `/home/milner/Desktop/rust/blazing_sun/src/routes/api.rs` - Route registration

---

## Related Documentation

- [API Routes](../Routes/Api/API_ROUTES.md) - Complete API endpoint reference
- [Database Layer](../Database/DATABASE.md) - Query patterns and migrations
- [Uploads](../Uploads/UPLOADS.md) - File upload system
- [Permissions](../Permissions/PERMISSIONS.md) - Permission levels
