# Database Schema

## Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts |
| `categories` | Budget categories per user |
| `transactions` | Income/expense records |
| `activation_hashes` | Activation/reset tokens |
| `uploads` | File upload records |
| `assets` | Asset records (legacy) |
| `site_config` | Global theme configuration (single row) |
| `page_seo` | Per-page SEO configuration |
| `page_schemas` | Schema.org structured data per page |
| `page_hreflangs` | Language/region targeting (placeholder) |

## Users Table

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| email | VARCHAR | Unique email |
| password | VARCHAR | Bcrypt hash |
| first_name | VARCHAR | First name |
| last_name | VARCHAR | Last name |
| balance | BIGINT | Balance in cents |
| activated | SMALLINT | 0=inactive, 1=active |
| user_must_set_password | SMALLINT | 0=no, 1=yes |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update |

## Uploads Table

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| uuid | UUID | Public identifier |
| user_id | BIGINT | FK to users |
| original_name | VARCHAR | Original filename |
| stored_name | VARCHAR | Stored filename |
| storage_path | VARCHAR | Full path |
| mime_type | VARCHAR | MIME type |
| size_bytes | BIGINT | File size |
| extension | VARCHAR | File extension |
| visibility | VARCHAR | public/private |
| checksum | VARCHAR | SHA256 hash |
| created_at | TIMESTAMP | Upload time |

**Note:** Money is stored as `BIGINT` (cents) for precision.
