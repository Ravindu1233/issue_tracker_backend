# Issue Tracker — Express.js Backend

A RESTful API built with **Node.js + Express.js**, **MySQL**, and **JWT authentication** for the Issue Tracker assignment.

---

## Tech Stack

| Layer          | Technology                        |
|----------------|-----------------------------------|
| Runtime        | Node.js                           |
| Framework      | Express.js                        |
| Database       | MySQL (via `mysql2`)              |
| Authentication | JWT (`jsonwebtoken`)              |
| Passwords      | Bcrypt hashing (`bcryptjs`)       |
| Config         | `dotenv`                          |
| CORS           | `cors`                            |

---

## Folder Structure

```
issue-tracker-backend/
├── src/
│   ├── app.js                  # Express app + server bootstrap
│   ├── db/
│   │   └── connection.js       # MySQL connection pool
│   ├── middleware/
│   │   └── authMiddleware.js   # JWT verification middleware
│   └── routes/
│       ├── auth.js             # POST /register, POST /login
│       ├── issues.js           # Full CRUD + stats + search/filter/pagination
│       ├── settings.js         # User dark mode and notification preferences
│       └── notifications.js    # User notifications
├── db.sql                      # Database schema — run once to set up tables
├── .env.example                # Sample environment variables
├── package.json
└── README.md
```

---

## Setup Instructions

### 1. Prerequisites

- Node.js ≥ 18.x
- MySQL ≥ 8.x (running locally or on a server)

### 2. Clone & Install

```bash
git clone <your-repo-url>
cd issue-tracker-backend
npm install
```

### 3. Configure Environment

Copy the sample env file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=5000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=issue_tracker

JWT_SECRET=replace_with_a_long_random_string
JWT_EXPIRES_IN=7d
```

### 4. Set Up the Database

Run the provided SQL file in your MySQL client:

```bash
mysql -u root -p < db.sql
```

Or paste its contents into MySQL Workbench / DBeaver / phpMyAdmin.

The schema uses `users`, `issues`, `user_settings`, and `notifications`. Issue `status` and `priority` are stored directly on `issues` as MySQL `ENUM` columns, so separate status/priority tables are not required.

If you already created an older database with separate status/priority lookup tables, run:

```bash
mysql -u root -p issue_tracker < migrations/001_inline_issue_enums.sql
```

If your database already exists and only needs the settings and notifications tables, run:

```bash
mysql -u root -p issue_tracker < migrations/004_add_user_settings_and_notifications.sql
```

### 5. Start the Server

```bash
# Production
npm start

# Development (auto-restart on changes)
npm run dev
```

The server starts at **http://localhost:5000** (or your `PORT`).

---

## API Reference

All responses are JSON. Issue routes require a **Bearer token** in the `Authorization` header.

```
Authorization: Bearer <jwt_token>
```

---

### Auth — `/api/auth`

#### `POST /api/auth/register`

Register a new user.

**Request body:**
```json
{
  "full_name": "Example User",
  "email": "user@example.com",
  "password": "secret123"
}
```

**Success `201`:**
```json
{
  "message": "Account created successfully.",
  "token": "<jwt>",
  "user": { "id": 1, "full_name": "Example User", "email": "user@example.com" }
}
```

---

#### `POST /api/auth/login`

Log in an existing user.

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

**Success `200`:**
```json
{
  "message": "Logged in successfully.",
  "token": "<jwt>",
  "user": { "id": 1, "full_name": "Example User", "email": "user@example.com" }
}
```

---

### Issues — `/api/issues` *(JWT required)*

#### `GET /api/issues`

Get all issues with optional search, filter, sort, and pagination.

**Query parameters:**

| Param      | Type   | Default      | Description                                        |
|------------|--------|--------------|----------------------------------------------------|
| `search`   | string | `""`         | Filter by title (partial match)                    |
| `status`   | string | —            | `Open` / `In Progress` / `Resolved` / `Closed`     |
| `priority` | string | —            | `Low` / `Medium` / `High`                          |
| `page`     | int    | `1`          | Page number                                        |
| `limit`    | int    | `10`         | Items per page (max 100)                           |
| `sortBy`   | string | `created_at` | `created_at` / `updated_at` / `title` / `status` / `priority` |
| `order`    | string | `DESC`       | `ASC` or `DESC`                                    |

**Example:**
```
GET /api/issues?search=login&status=Open&priority=High&page=1&limit=5
```

**Success `200`:**
```json
{
  "issues": [ ... ],
  "pagination": {
    "totalItems": 42,
    "totalPages": 9,
    "currentPage": 1,
    "limit": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

---

#### `GET /api/issues/stats`

Get issue counts grouped by status (for dashboard cards).

**Success `200`:**
```json
{
  "stats": [
    { "status": "Open",        "total": 12 },
    { "status": "In Progress", "total": 5  },
    { "status": "Resolved",    "total": 20 },
    { "status": "Closed",      "total": 3  }
  ],
  "totalIssues": 40
}
```

> ⚠️ Call `/api/issues/stats` **before** `/api/issues/:id` — the route is registered in that order.

---

#### `GET /api/issues/:id`

Get a single issue by ID.

**Success `200`:**
```json
{
  "issue": {
    "id": 1,
    "title": "Login page broken",
    "description": "...",
    "status": "Open",
    "priority": "High",
    "user_id": 1,
    "created_at": "2024-06-01T10:00:00.000Z",
    "updated_at": "2024-06-01T10:00:00.000Z",
    "created_by": "user@example.com"
  }
}
```

---

#### `POST /api/issues`

Create a new issue.

**Request body:**
```json
{
  "title": "Login page broken",
  "description": "The login button throws a 500 error.",
  "status": "Open",
  "priority": "High"
}
```

`description`, `status`, and `priority` are optional (default: `""`, `"Open"`, `"Medium"`).

**Success `201`:**
```json
{
  "message": "Issue created successfully.",
  "issue": { ... }
}
```

---

#### `PUT /api/issues/:id`

Update an existing issue (partial updates supported).

**Request body (all fields optional):**
```json
{
  "title": "Updated title",
  "status": "Resolved",
  "priority": "Low"
}
```

**Success `200`:**
```json
{
  "message": "Issue updated successfully.",
  "issue": { ... }
}
```

If another user changes the issue creator's issue status to `In Progress`, `Resolved`, or `Closed`, the creator is notified based on their settings:

- `show_notifications: true` creates an in-app notification.
- `email_notifications: true` sends an email notification.

---

#### `DELETE /api/issues/:id`

Delete an issue by ID.

**Success `200`:**
```json
{
  "message": "Issue 5 deleted successfully."
}
```

---

### Settings - `/api/settings` *(JWT required)*

#### `GET /api/settings`

Returns the logged-in user's settings. Missing settings rows are created with all values set to `false`.

**Success `200`:**
```json
{
  "settings": {
    "id": 1,
    "user_id": 1,
    "dark_mode": false,
    "show_notifications": false,
    "email_notifications": false,
    "created_at": "2026-05-20T00:00:00.000Z",
    "updated_at": "2026-05-20T00:00:00.000Z"
  }
}
```

#### `PUT /api/settings`

Update one or more settings. Values must be boolean-compatible (`true`, `false`, `1`, `0`, `"true"`, `"false"`).

**Request body:**
```json
{
  "dark_mode": true,
  "show_notifications": true,
  "email_notifications": false
}
```

When a setting value changes, a notification row is created for that user.
Issue status notifications are also controlled here: turn on `show_notifications` for app notifications and `email_notifications` for email notifications.

---

### Notifications - `/api/notifications` *(JWT required)*

#### `GET /api/notifications`

Supports pagination and unread filtering.

```http
GET /api/notifications?page=1&limit=20&unreadOnly=true
```

#### `PATCH /api/notifications/:id/read`

Marks one notification as read.

#### `PATCH /api/notifications/read-all`

Marks all unread notifications for the logged-in user as read.

#### `DELETE /api/notifications/:id`

Deletes one notification owned by the logged-in user.

---

## HTTP Status Codes

| Code | Meaning                              |
|------|--------------------------------------|
| 200  | OK                                   |
| 201  | Created                              |
| 400  | Bad Request (validation error)       |
| 401  | Unauthorized (missing / invalid JWT) |
| 404  | Not Found                            |
| 500  | Internal Server Error                |

---

## Validation Rules

| Field      | Rule                                                  |
|------------|-------------------------------------------------------|
| `full_name` | Required, max 255 characters                        |
| `email`    | Required, valid email format                          |
| `password` | Required, minimum 6 characters                        |
| `title`    | Required, max 255 characters                          |
| `status`   | Must be one of: `Open`, `In Progress`, `Resolved`, `Closed` |
| `priority` | Must be one of: `Low`, `Medium`, `High`               |
| `dark_mode` | Must be true or false                                |
| `show_notifications` | Must be true or false                       |
| `email_notifications` | Must be true or false                      |

---

## Health Check

```
GET /api/health
→ 200 { "status": "OK", "timestamp": "..." }
```

---

## Dependencies

```
express       — Web framework
mysql2        — MySQL client (promise-based)
jsonwebtoken  — JWT creation & verification
bcryptjs      — Password hashing
dotenv        — Environment variable loading
cors          — Cross-Origin Resource Sharing

nodemon       — Dev auto-restart (devDependency)
```

Install all with:
```bash
npm install
```
