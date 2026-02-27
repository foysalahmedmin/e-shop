# Technical Specification: Unified M-Commerce & E-Commerce Platform

> Internal developer reference. Covers architecture, tech stack, data models, API design, module structure, and implementation approach.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure & Monorepo Layout](#3-project-structure--monorepo-layout)
4. [Domain Modules](#4-domain-modules)
5. [Database Design](#5-database-design)
6. [Multi-Tenancy](#6-multi-tenancy)
7. [API Design](#7-api-design)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Frontend Architecture](#9-frontend-architecture)
10. [AI Components](#10-ai-components)
11. [Payment Gateway Integration](#11-payment-gateway-integration)
12. [Message Queue & Async Processing](#12-message-queue--async-processing)
13. [Search Architecture](#13-search-architecture)
14. [Caching Strategy](#14-caching-strategy)
15. [File Storage & Media Pipeline](#15-file-storage--media-pipeline)
16. [POS System](#16-pos-system)
17. [Shipping & Tax Engines](#17-shipping--tax-engines)
18. [Third-Party Integrations](#18-third-party-integrations)
19. [Testing Strategy](#19-testing-strategy)
20. [DevOps & Deployment](#20-devops--deployment)
21. [Security](#21-security)
22. [Performance & Scalability](#22-performance--scalability)
23. [Error Handling & Logging](#23-error-handling--logging)
24. [Future Considerations](#24-future-considerations)

---

## 1. Architecture Overview

### 1.1 Philosophy

**Modular Monolith** — a single deployable unit with strict domain boundaries between modules. Modules communicate via:

- **In-process function calls** for synchronous operations (e.g., order creation calls payment module)
- **RabbitMQ events** for async side effects (e.g., order placed → send confirmation email, update analytics)

This gives us the organizational clarity of microservices without the operational cost. Any module can be extracted into its own service later by replacing in-process calls with HTTP/gRPC and routing events through the queue.

### 1.2 High-Level Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                          CLIENTS                             │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │  Storefront  │  │ Seller Portal  │  │  Admin Panel     │  │
│  │  (Next.js)   │  │ (React SPA)    │  │  (React SPA)     │  │
│  └──────┬───────┘  └───────┬────────┘  └─────────┬────────┘  │
└─────────┼──────────────────┼─────────────────────┼───────────┘
          │                  │                     │
     ┌────▼──────────────────▼─────────────────────▼────┐
     │              Nginx Reverse Proxy                 │
     │     (SSL termination, rate limiting, routing)    │
     └───────────────────────┬──────────────────────────┘
                             │
     ┌───────────────────────▼──────────────────────────┐
     │            Node.js API Server (Express)          │
     │                                                  │
     │ ┌──────────┬──────────┬──────────┬─────────────┐ │
     │ │   Auth   │  Tenant  │ Catalog  │   Orders    │ │
     │ │  Module  │  Module  │  Module  │   Module    │ │
     │ ├──────────┼──────────┼──────────┼─────────────┤ │
     │ │ Payments │ Shipping │   POS    │    CRM      │ │
     │ │  Module  │  Module  │  Module  │   Module    │ │
     │ ├──────────┼──────────┼──────────┼─────────────┤ │
     │ │   Tax    │  Media   │ Webhook  │ Integration │ │
     │ │  Module  │  Module  │  Module  │   Module    │ │
     │ └──────────┴──────────┴──────────┴─────────────┘ │
     └──────┬────────────┬──────────┬────────────┬──────┘
            │            │          │            │
     ┌──────▼──────┐ ┌───▼────┐ ┌───▼───┐ ┌──────▼──────┐
     │  PostgreSQL │ │ MongoDB│ │ Redis │ │  RabbitMQ   │
     │  (Primary)  │ │ (CMS/  │ │ Cache │ │ (Async Msg) │
     │             │ │Templts)│ │       │ │             │
     └─────────────┘ └────────┘ └───────┘ └──────┬──────┘
                                                 │
                                 ┌───────────────▼──────┐
                                 │    Elasticsearch     │
                                 │  (Search + Vectors)  │
                                 └──────────────────────┘
```

### 1.3 Request Flow

1. Client makes HTTPS request → Nginx terminates SSL, applies rate limits
2. Nginx routes to Next.js (storefront SSR) or Express API (all other requests)
3. Express middleware chain: `cors → helmet → tenantContext → auth → validation → controller`
4. Controller delegates to service layer → service calls repository layer → DB
5. Async side effects published to RabbitMQ → consumed by background workers
6. Response returned through the chain

---

## 2. Technology Stack

| Layer | Technology | Role |
|-------|-----------|------|
| **Frontend (Storefront)** | Next.js + React | SSR for SEO, PWA, storefront UX |
| **Frontend (Seller/Admin)** | React + Vite | SPA dashboards — no SSR needed |
| **API Server** | Node.js + Express | REST API, business logic, background workers |
| **Primary Database** | PostgreSQL | Relational data — products, orders, users, tenants |
| **Document Store** | MongoDB | CMS content, store templates, flexible config blobs |
| **Search** | Elasticsearch | Full-text product search, vector similarity for AI image search |
| **Cache** | Redis | Session cache, rate limiting, pub/sub for real-time sync |
| **Message Queue** | RabbitMQ | Async event processing, email triggers, webhook delivery |
| **File Storage** | S3-compatible (MinIO / cloud S3) | Product images, media, documents |
| **Containers** | Docker + Docker Compose | Dev and deployment environments |
| **CI/CD** | GitHub Actions / Jenkins | Automated testing, build, deploy pipelines |
| **Reverse Proxy** | Nginx | SSL, routing, rate limiting, static asset serving |

### 2.1 Why These Choices

- **PostgreSQL over MongoDB for primary data**: Our data is inherently relational — products have categories, orders have line items, users belong to tenants. PostgreSQL gives us ACID transactions, Row-Level Security for multi-tenancy, and `jsonb` columns for the occasional flexible field. MongoDB is reserved for truly document-shaped data (store templates, CMS blocks).
- **RabbitMQ over Kafka**: At launch scale, RabbitMQ gives us reliable async messaging with dead-letter queues, retries, and minimal resource usage (~50-100 MB RAM). Kafka's partitioned log model is designed for high-throughput event streaming (100K+ msg/sec) — it's the right upgrade path later, not the right starting point.
- **Next.js only for storefront**: Product and category pages need SSR for SEO and social sharing. The seller dashboard and admin panel are behind authentication — no SEO value, so a Vite-bundled React SPA is lighter and faster to develop.
- **Express over Fastify/Koa**: Largest middleware ecosystem, most familiar to developers, battle-tested at scale. The performance difference is negligible at our expected request volumes.

---

## 3. Project Structure & Monorepo Layout

```
/
├── apps/
│   ├── storefront/              # Next.js — customer-facing store
│   │   ├── src/
│   │   │   ├── app/             # Next.js App Router pages
│   │   │   ├── components/      # UI components
│   │   │   ├── hooks/           # Custom React hooks
│   │   │   ├── lib/             # Utility functions, API client
│   │   │   └── styles/          # Global styles, theme
│   │   ├── public/              # Static assets, PWA manifest
│   │   └── next.config.js
│   │
│   ├── seller/                  # React SPA — seller dashboard
│   │   ├── src/
│   │   │   ├── pages/           # Route-based pages
│   │   │   ├── components/      # UI components
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── store/           # State management (Zustand)
│   │   └── vite.config.ts
│   │
│   └── admin/                   # React SPA — platform admin
│       ├── src/
│       └── vite.config.ts
│
├── server/                      # Node.js API server (Express)
│   ├── src/
│   │   ├── modules/             # Domain modules (see Section 4)
│   │   │   ├── auth/
│   │   │   ├── tenant/
│   │   │   ├── catalog/
│   │   │   ├── orders/
│   │   │   ├── payments/
│   │   │   ├── shipping/
│   │   │   ├── pos/
│   │   │   ├── crm/
│   │   │   ├── tax/
│   │   │   ├── media/
│   │   │   ├── webhook/
│   │   │   └── integration/
│   │   │
│   │   ├── common/              # Shared utilities
│   │   │   ├── middleware/      # Auth, tenant context, error handler, validation
│   │   │   ├── database/       # DB connection, migrations, seed
│   │   │   ├── queue/          # RabbitMQ connection, publisher, consumer base
│   │   │   ├── cache/          # Redis client wrapper
│   │   │   ├── errors/         # Custom error classes
│   │   │   ├── logger/         # Structured logging (pino)
│   │   │   └── utils/          # Helpers (pagination, slug, etc.)
│   │   │
│   │   ├── config/             # Environment-based configuration
│   │   ├── workers/            # Background job consumers
│   │   └── app.js              # Express app setup
│   │
│   ├── migrations/             # PostgreSQL migrations (knex or node-pg-migrate)
│   ├── seeds/                  # Seed data
│   └── tests/
│       ├── unit/
│       ├── integration/
│       └── fixtures/
│
├── packages/                   # Shared packages (if needed)
│   └── shared-types/           # TypeScript types shared across apps
│
├── docker/
│   ├── docker-compose.yml      # Full local stack
│   ├── docker-compose.dev.yml  # Dev overrides (hot reload, volumes)
│   ├── Dockerfile.server
│   ├── Dockerfile.storefront
│   └── nginx/
│       └── nginx.conf
│
├── scripts/                    # Dev/deploy utility scripts
├── .github/workflows/          # CI/CD pipelines (if GitHub Actions)
├── Jenkinsfile                 # CI/CD pipeline (if Jenkins)
├── package.json                # Root workspace config
└── turbo.json                  # Turborepo config (build orchestration)
```

### 3.1 Module Internal Structure

Each module under `server/src/modules/` follows the same layout:

```
modules/catalog/
├── catalog.routes.js           # Express router — route definitions
├── catalog.controller.js       # Request handling — parse input, call service, format response
├── catalog.service.js          # Business logic — orchestration, validation, rules
├── catalog.repository.js       # Data access — SQL queries, DB operations
├── catalog.model.js            # Entity definitions / query builders
├── catalog.validator.js        # Input validation schemas (Joi/Zod)
├── catalog.events.js           # Event names + publishers for this module
├── catalog.errors.js           # Module-specific error classes
└── __tests__/
    ├── catalog.service.test.js
    └── catalog.routes.test.js
```

**Rules:**
- Modules NEVER import directly from another module's repository or model layer
- Cross-module calls go through the service layer: `ordersService.create()` calls `paymentsService.charge()` calls `catalogService.decrementStock()`
- Async side effects use events: `orderEvents.emit('order.placed', orderData)` → RabbitMQ → email worker, analytics worker, webhook worker

---

## 4. Domain Modules

### 4.1 Module Dependency Map

```
                    ┌───────────┐
                    │   Auth    │
                    └─────┬─────┘
                          │ (all modules depend on auth)
          ┌───────────────┼────────────────┐
          │               │                │
    ┌─────▼─────┐  ┌─────▼──────┐  ┌──────▼─────┐
    │  Tenant   │  │  Catalog   │  │   Media    │
    └─────┬─────┘  └──┬─────┬───┘  └────────────┘
          │           │     │
          │     ┌─────▼──┐  │
          │     │ Orders ├──┘
          │     └──┬──┬──┘
          │        │  │
     ┌────▼────┐   │  └──────────┐
     │   POS   ├───┘       ┌─────▼─────┐
     └─────────┘           │ Payments  │
                           └─────┬─────┘
                                 │
          ┌──────────┬───────────┼──────────┐
          │          │           │          │
    ┌─────▼────┐ ┌──▼────┐ ┌───▼───┐ ┌───▼────────┐
    │ Shipping │ │  Tax  │ │  CRM  │ │Integration │
    └──────────┘ └───────┘ └───────┘ └────────────┘
                                           │
                                     ┌─────▼─────┐
                                     │  Webhook  │
                                     └───────────┘
```

### 4.2 Module Responsibilities

| Module | Responsibility | Key Entities | Depends On |
|--------|---------------|--------------|------------|
| **Auth** | Registration, login, JWT, OAuth, password reset, RBAC | User, Session, Role, Permission | — |
| **Tenant** | Tenant lifecycle, provisioning, plan management, subdomain routing | Tenant, Subscription, Plan | Auth |
| **Catalog** | Products, categories, variants, pricing, media association | Product, Category, Variant, ProductMedia | Auth, Tenant, Media |
| **Orders** | Order lifecycle, fulfillment, returns, refunds | Order, OrderItem, Refund, Fulfillment | Auth, Catalog, Payments |
| **Payments** | Gateway abstraction, charge/refund, reconciliation, payout tracking | Payment, Transaction, PaymentMethod | Auth, Tenant |
| **Shipping** | Carrier API integration, rate calculation, label gen, tracking | Shipment, ShippingRate, TrackingEvent | Auth, Orders |
| **POS** | In-person sales, register management, receipt generation | Register, POSSale, POSLineItem, Receipt | Auth, Catalog, Payments |
| **CRM** | Customer profiles, AI chatbot, segmentation, messaging | Customer, Conversation, Message, Segment | Auth, Orders |
| **Tax** | Tax rate lookup, calculation engine, compliance reporting | TaxRate, TaxRule, Jurisdiction, TaxReport | Auth, Tenant |
| **Media** | File upload, image processing (resize, optimize), CDN URL generation | MediaFile, ImageTransform | Auth, Tenant |
| **Webhook** | Outbound event delivery, retry with exponential backoff, delivery log | WebhookEndpoint, WebhookDelivery | Auth, Tenant |
| **Integration** | Third-party connectors (Xero, Intuit), sync engine, config management | IntegrationConfig, SyncLog, FieldMapping | Auth, Tenant, Orders |

---

## 5. Database Design

### 5.1 PostgreSQL — Primary Store

All relational, transactional data lives here. Key design decisions:

- **Every table has `tenant_id`** — enforced by RLS policies (see Section 6)
- **UUID primary keys** — avoids integer sequence leaks between tenants
- **`created_at` / `updated_at` timestamps** on all tables — `updated_at` auto-set via trigger
- **Soft deletes** via `deleted_at` column where business logic requires it (orders, customers)
- **`jsonb` columns** for semi-structured extension fields (product metadata, custom attributes)

### 5.2 Core Schema (Simplified ERD)

```
tenants
├── id (uuid, PK)
├── name
├── slug (unique — used for subdomain routing)
├── plan_id (FK → plans)
├── settings (jsonb)
├── status (active/suspended/trial)
├── created_at / updated_at

plans
├── id (uuid, PK)
├── name (free/starter/pro/enterprise)
├── limits (jsonb — max_products, max_staff, etc.)
├── price_monthly / price_yearly

users
├── id (uuid, PK)
├── tenant_id (FK → tenants)
├── email (unique per tenant)
├── password_hash
├── role (owner/admin/staff/customer)
├── profile (jsonb — name, phone, avatar_url)
├── last_login_at
├── created_at / updated_at

products
├── id (uuid, PK)
├── tenant_id (FK → tenants)
├── title
├── slug (unique per tenant)
├── description (text)
├── status (draft/active/archived)
├── category_id (FK → categories)
├── metadata (jsonb — custom attributes)
├── created_at / updated_at

variants
├── id (uuid, PK)
├── product_id (FK → products)
├── tenant_id
├── sku (unique per tenant)
├── title (e.g., "Red / Large")
├── price (decimal)
├── compare_at_price (decimal, nullable — for "was $X" display)
├── cost_price (decimal, nullable — for profit calculation)
├── stock_quantity (integer)
├── options (jsonb — {color: "Red", size: "L"})
├── weight / dimensions (for shipping calc)

categories
├── id (uuid, PK)
├── tenant_id
├── name / slug
├── parent_id (FK → categories, nullable — for nesting)
├── position (integer — sort order)

orders
├── id (uuid, PK)
├── tenant_id
├── customer_id (FK → customers)
├── order_number (sequential per tenant, human-readable)
├── status (pending/confirmed/processing/shipped/delivered/cancelled/refunded)
├── subtotal / tax_total / shipping_total / discount_total / grand_total (decimal)
├── currency (varchar(3) — ISO 4217)
├── shipping_address / billing_address (jsonb)
├── notes (text)
├── source (online/pos)
├── placed_at / fulfilled_at / cancelled_at

order_items
├── id (uuid, PK)
├── order_id (FK → orders)
├── tenant_id
├── product_id / variant_id
├── title / sku (denormalized at time of order — product may change later)
├── quantity
├── unit_price / total_price
├── tax_amount
├── discount_amount

payments
├── id (uuid, PK)
├── tenant_id
├── order_id (FK → orders)
├── gateway (stripe/sslcommerz/bkash)
├── gateway_transaction_id
├── amount / currency
├── status (pending/captured/failed/refunded)
├── metadata (jsonb — gateway-specific response data)
├── paid_at / refunded_at

customers
├── id (uuid, PK)
├── tenant_id
├── email
├── name / phone
├── total_orders / total_spent (denormalized counters)
├── tags (text[] — for segmentation)
├── notes (text)
├── first_order_at / last_order_at

shipments
├── id (uuid, PK)
├── tenant_id
├── order_id (FK → orders)
├── carrier / tracking_number
├── status (pending/in_transit/delivered/returned)
├── label_url
├── shipped_at / delivered_at

tax_rates
├── id (uuid, PK)
├── country / state / county / city
├── rate (decimal)
├── tax_type (sales_tax/vat)
├── effective_from / effective_to
```

### 5.3 MongoDB — Document Store

Used for:

| Collection | Purpose |
|-----------|---------|
| `store_templates` | Theme/layout definitions — deeply nested JSON with sections, blocks, settings |
| `cms_pages` | Custom pages built by merchants — flexible block-based content |
| `email_templates` | Notification email templates (HTML + variables) |
| `integration_configs` | Third-party connector settings — varies wildly per integration |
| `ai_conversations` | Chat history with AI bot — append-heavy, no joins needed |

**Rule of thumb**: If the data needs joins, transactions, or aggregation across entities → PostgreSQL. If the data is self-contained documents with unpredictable schema → MongoDB.

### 5.4 Migrations

- Tool: `node-pg-migrate` (or Knex migrations)
- Migrations run on app startup in development, as a CI step in production
- Every migration has an `up` and `down` function
- Naming convention: `YYYYMMDDHHMMSS_description.js` (e.g., `20260301120000_create_products_table.js`)
- Seed data is separate from migrations — never mix structural changes with data

---

## 6. Multi-Tenancy

### 6.1 Strategy: Shared Database + Row-Level Security

All tenants share the same PostgreSQL database and schema. Isolation is enforced at the database level using PostgreSQL's Row-Level Security (RLS):

```sql
-- Enable RLS on products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see/modify rows matching their tenant
CREATE POLICY tenant_isolation ON products
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 6.2 Tenant Context Middleware

Every API request passes through tenant resolution middleware:

```javascript
// middleware/tenantContext.js
async function tenantContext(req, res, next) {
  // Resolve tenant from subdomain: myshop.platform.com → "myshop"
  const slug = req.hostname.split('.')[0];
  const tenant = await tenantCache.getOrFetch(slug);

  if (!tenant || tenant.status !== 'active') {
    return res.status(404).json({ error: 'Store not found' });
  }

  req.tenant = tenant;

  // Set PostgreSQL session variable for RLS
  await req.db.raw(`SET LOCAL app.current_tenant = '${tenant.id}'`);

  next();
}
```

### 6.3 Tenant Routing

| Pattern | Example | Resolution |
|---------|---------|-----------|
| Subdomain | `myshop.platform.com` | Extract first subdomain segment |
| Custom domain | `www.myshop.com` | Lookup in `tenant_domains` table |
| Path-based (admin) | `platform.com/admin/tenant/123` | Admin panel routes by tenant ID |

### 6.4 Scalability Path

1. **Now**: Shared database, RLS isolation — simplest to operate
2. **When performance demands**: Table partitioning by `tenant_id` — PostgreSQL native partitioning or Citus extension
3. **For large tenants**: Dedicated database instance — connection routing at middleware level based on tenant config

---

## 7. API Design

### 7.1 REST Conventions

```
Base URL: /api/v1

Resources follow plural nouns:
  GET    /api/v1/products              → List products (paginated)
  GET    /api/v1/products/:id          → Get single product
  POST   /api/v1/products              → Create product
  PUT    /api/v1/products/:id          → Update product (full replace)
  PATCH  /api/v1/products/:id          → Partial update
  DELETE /api/v1/products/:id          → Soft delete

Nested resources:
  GET    /api/v1/products/:id/variants → List variants for a product
  POST   /api/v1/orders/:id/refunds   → Create refund for an order

Actions (when CRUD doesn't fit):
  POST   /api/v1/orders/:id/fulfill   → Mark order as fulfilled
  POST   /api/v1/orders/:id/cancel    → Cancel order
  POST   /api/v1/checkout/calculate    → Calculate cart totals
```

### 7.2 Pagination

Cursor-based pagination for large collections, offset-based for admin dashboards:

```json
// Request
GET /api/v1/products?limit=20&cursor=eyJpZCI6IjEyMyJ9

// Response
{
  "data": [...],
  "pagination": {
    "limit": 20,
    "hasMore": true,
    "nextCursor": "eyJpZCI6IjE0MyJ9"
  }
}
```

### 7.3 Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      { "field": "price", "message": "Must be a positive number" },
      { "field": "title", "message": "Required" }
    ]
  }
}
```

Standard HTTP status codes: `200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, `422`, `429`, `500`.

### 7.4 Rate Limiting

- **Per-tenant**: 100 req/sec for storefront, 50 req/sec for seller API
- **Per-IP (unauthenticated)**: 30 req/sec
- Implemented at Nginx level (global) + Redis-based sliding window (per-tenant)
- `429 Too Many Requests` response includes `Retry-After` header

---

## 8. Authentication & Authorization

### 8.1 Auth Flow

```
Registration → email/password → hash with bcrypt (cost=12) → store in users table
Login → verify credentials → issue JWT access token (15min) + refresh token (7d)
Refresh → validate refresh token → issue new access + refresh pair → rotate refresh token
OAuth → Google OAuth2 → create/link user → issue tokens
```

### 8.2 JWT Structure

```json
// Access token payload
{
  "sub": "user-uuid",
  "tid": "tenant-uuid",
  "role": "admin",
  "permissions": ["products:write", "orders:read", "orders:write"],
  "iat": 1709251200,
  "exp": 1709252100
}
```

### 8.3 RBAC

| Role | Scope | Permissions |
|------|-------|------------|
| **owner** | Full tenant access | All permissions |
| **admin** | Tenant management | All except billing/plan changes |
| **staff** | Day-to-day operations | Products, orders, customers, POS |
| **customer** | Own data only | View/edit own profile, orders, addresses |

### 8.4 Middleware Chain

```javascript
// Protected route example
router.get('/products',
  authenticate,        // Verify JWT, attach req.user
  requireRole('staff'), // Minimum role check
  requirePermission('products:read'),
  productController.list
);
```

---

## 9. Frontend Architecture

### 9.1 Storefront (Next.js)

**Rendering strategy by page:**

| Page | Rendering | Reason |
|------|-----------|--------|
| Home / Landing | SSR + ISR (revalidate 60s) | SEO + dynamic content |
| Product listing | SSR | SEO, filterable, paginated |
| Product detail | SSR + ISR | SEO, social sharing (OG tags) |
| Cart | CSR | Fully interactive, no SEO value |
| Checkout | CSR | Authenticated flow |
| Account / Orders | CSR | Behind auth |
| Search results | SSR | SEO for category searches |

**PWA features:**
- Service worker for offline caching of viewed products
- Web app manifest for "Add to Home Screen"
- Push notifications for order status updates

**State management:**
- Server state: React Query (TanStack Query) — caching, background refetch, optimistic updates
- Client state: Zustand — cart, UI state, checkout flow
- No Redux — overkill for this use case

### 9.2 Seller Dashboard (React SPA)

- Vite build — fast HMR in dev, optimized production bundles
- Route-based code splitting via React Router lazy imports
- Zustand for state, React Query for API data
- Component library: build on top of a headless UI library (Radix or Headless UI) with Tailwind CSS
- Key pages: Products, Orders, Customers, Analytics, Settings, POS

### 9.3 Admin Panel (React SPA)

- Same stack as Seller Dashboard
- Tenant management, platform analytics, plan management, system config
- Separate deployment — different access control

### 9.4 Shared Patterns

- **API Client**: Shared axios instance with interceptors for auth token injection, refresh token rotation, tenant header
- **Form handling**: React Hook Form + Zod validation (same schemas as server-side where possible)
- **Error boundaries**: Per-route error boundaries with fallback UI
- **i18n**: Prepared but not implemented in M1 — structure supports it from day one

---

## 10. AI Components

### 10.1 Visual Image Search

**Flow:**
1. Customer uploads an image via the storefront
2. Image sent to server → forwarded to an embedding service (hosted ML model or third-party API)
3. Embedding service returns a vector (e.g., 512-dimensional float array)
4. Server queries Elasticsearch using vector similarity (k-NN search)
5. Top N matching products returned to the client

**Indexing pipeline:**
- When a product image is uploaded, compute its embedding asynchronously (via RabbitMQ job)
- Store the embedding vector in Elasticsearch alongside the product document
- Re-index when product images change

**Elasticsearch mapping:**
```json
{
  "properties": {
    "product_id": { "type": "keyword" },
    "tenant_id": { "type": "keyword" },
    "title": { "type": "text" },
    "image_embedding": {
      "type": "dense_vector",
      "dims": 512,
      "index": true,
      "similarity": "cosine"
    }
  }
}
```

### 10.2 AI Chatbot CRM

- Conversational interface embedded in the storefront
- Backend integrates with a hosted LLM API
- Context injection: customer's order history, product catalog summaries, store policies
- Conversation history persisted in MongoDB (`ai_conversations` collection)
- Fallback to human support when AI confidence is low or customer requests it

### 10.3 Smart Recommendations

Approaches (layered, from simplest to most sophisticated):

1. **Frequently bought together**: SQL query on `order_items` — products appearing in same orders
2. **Customers also viewed**: Track product view sessions in Redis, compute co-occurrence
3. **Personalized**: Collaborative filtering on purchase history — compute offline, serve from cache

All recommendation logic runs server-side. No client-side ML.

---

## 11. Payment Gateway Integration

### 11.1 Gateway Abstraction

```javascript
// payments/gateways/gateway.interface.js
class PaymentGateway {
  async createIntent(amount, currency, metadata) { /* ... */ }
  async capturePayment(intentId) { /* ... */ }
  async refund(transactionId, amount) { /* ... */ }
  async getTransaction(transactionId) { /* ... */ }
  async handleWebhook(payload, signature) { /* ... */ }
}
```

Implementations: `StripeGateway`, `SSLCommerceGateway`, `BkashGateway` — all implement the same interface.

### 11.2 Payment Flow

```
1. Client creates checkout session
2. Server calls gateway.createIntent() → returns client secret / redirect URL
3. Client completes payment on gateway-hosted form (PCI compliant — we never touch raw card data)
4. Gateway sends webhook → server verifies signature → updates payment status
5. If payment captured → order status → confirmed → trigger fulfillment events
```

### 11.3 Webhook Verification

Each gateway has its own signature verification:
- **Stripe**: HMAC-SHA256 with webhook signing secret
- **SSL-Commerce**: IP whitelist + hash verification
- **Bkash**: Token-based callback verification

All webhook handlers are idempotent — duplicate delivery is handled by checking `gateway_transaction_id` uniqueness.

---

## 12. Message Queue & Async Processing

### 12.1 RabbitMQ Setup

**Exchanges:**
| Exchange | Type | Purpose |
|----------|------|---------|
| `events.topic` | Topic | Domain events — `order.placed`, `payment.captured`, etc. |
| `tasks.direct` | Direct | Background tasks — `email.send`, `image.process`, etc. |
| `webhooks.direct` | Direct | Outbound webhook delivery |

**Key queues:**
| Queue | Binding | Consumer |
|-------|---------|----------|
| `email.notifications` | `events.topic` → `order.*`, `payment.*` | Email worker |
| `search.index` | `events.topic` → `product.*`, `catalog.*` | Search indexing worker |
| `image.process` | `tasks.direct` → `image.process` | Media processing worker |
| `webhook.deliver` | `webhooks.direct` → `webhook.deliver` | Webhook delivery worker |
| `analytics.track` | `events.topic` → `#` (all events) | Analytics worker |

### 12.2 Event Schema

```json
{
  "eventId": "uuid",
  "eventType": "order.placed",
  "tenantId": "uuid",
  "timestamp": "2026-03-15T10:30:00Z",
  "data": {
    "orderId": "uuid",
    "customerId": "uuid",
    "totalAmount": 99.99,
    "currency": "USD"
  },
  "metadata": {
    "source": "storefront",
    "userId": "uuid"
  }
}
```

### 12.3 Retry & Dead Letter

- Failed messages retried 3 times with exponential backoff (1s, 5s, 25s)
- After 3 failures → routed to dead-letter queue for manual inspection
- Dead-letter dashboard in admin panel for ops visibility

---

## 13. Search Architecture

### 13.1 Elasticsearch Index Design

**Products index** (per-tenant data filtered by `tenant_id`):

```json
{
  "settings": {
    "analysis": {
      "analyzer": {
        "product_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "synonym_filter", "edge_ngram_filter"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "tenant_id": { "type": "keyword" },
      "product_id": { "type": "keyword" },
      "title": { "type": "text", "analyzer": "product_analyzer" },
      "description": { "type": "text" },
      "category": { "type": "keyword" },
      "tags": { "type": "keyword" },
      "price": { "type": "float" },
      "in_stock": { "type": "boolean" },
      "image_embedding": { "type": "dense_vector", "dims": 512, "similarity": "cosine" },
      "created_at": { "type": "date" }
    }
  }
}
```

### 13.2 Search Features

- **Full-text search**: Title, description, tags with relevance scoring
- **Faceted search**: Filter by category, price range, in-stock status, tags
- **Autocomplete**: Edge n-gram analyzer for type-ahead suggestions
- **Typo tolerance**: Fuzzy matching with edit distance 1-2
- **Visual search**: k-NN on `image_embedding` field (see Section 10)

### 13.3 Index Sync

Products are synced to Elasticsearch via RabbitMQ events:
- `product.created` → index new document
- `product.updated` → update document
- `product.deleted` → remove document
- `variant.stock_changed` → update `in_stock` field

Full re-index available as an admin action for recovery.

---

## 14. Caching Strategy

### 14.1 Redis Usage Map

| Key Pattern | TTL | Purpose |
|------------|-----|---------|
| `tenant:{slug}` | 5 min | Tenant config cache (avoid DB hit on every request) |
| `session:{userId}` | 7 days | Refresh token / session data |
| `cart:{sessionId}` | 30 days | Cart contents (guest and authenticated) |
| `ratelimit:{tenantId}:{window}` | 1 min | Sliding window rate limit counter |
| `product:{tenantId}:{productId}` | 2 min | Hot product detail cache |
| `catalog:featured:{tenantId}` | 5 min | Featured products list |
| `pos:register:{registerId}` | — | Real-time POS register state (pub/sub) |
| `recommendation:{tenantId}:{productId}` | 1 hour | Pre-computed product recommendations |

### 14.2 Cache Invalidation

- **Write-through**: On product update, update both PostgreSQL and invalidate Redis key
- **Event-driven**: RabbitMQ event triggers cache invalidation in consumer
- **TTL-based**: All cached data has a TTL — stale data eventually self-corrects
- **No cache-aside for critical paths**: Payments and orders always read from PostgreSQL

---

## 15. File Storage & Media Pipeline

### 15.1 Upload Flow

```
1. Client requests a signed upload URL: POST /api/v1/media/upload-url
2. Server generates pre-signed S3 PUT URL (valid 15 min) + media record in DB
3. Client uploads directly to S3 (no file passes through our server)
4. Client confirms upload: POST /api/v1/media/:id/confirm
5. Server publishes image.process event → media worker
6. Worker generates thumbnails (150px, 400px, 800px), optimizes (WebP), stores variants in S3
7. Worker updates media record with variant URLs
```

### 15.2 Image Processing

- Resize to standard sizes: thumbnail (150px), medium (400px), large (800px), original
- Convert to WebP for modern browsers (with JPEG fallback)
- Strip EXIF data (privacy)
- Generate embedding vector for AI image search (async)

### 15.3 CDN Integration

- S3 bucket fronted by CDN (CloudFront or equivalent)
- Immutable URLs with content hash: `/media/abc123/product-400w.webp`
- Cache headers: `Cache-Control: public, max-age=31536000, immutable`

---

## 16. POS System

### 16.1 Architecture

The POS runs as a view within the Seller Dashboard (React SPA) optimized for tablet/mobile:

- **Online-first** with offline fallback for critical operations
- **Real-time sync** via Redis pub/sub — inventory changes, price updates reflect immediately
- **Same API** as online storefront — no separate POS backend

### 16.2 Key Flows

**Sale:**
1. Staff scans barcode or searches product → adds to POS cart
2. Apply discounts / manual price adjustments
3. Select payment method (cash / card / mobile)
4. For card: use Stripe Terminal SDK or payment gateway redirect
5. Create order (source: `pos`) → decrement inventory → generate receipt
6. Receipt available as digital (email/SMS) or print (ESC/POS protocol)

**Inventory sync:**
- POS cart locks inventory (Redis `DECR` with TTL)
- If online order takes last stock during POS session → POS notified in real-time via pub/sub
- Conflict resolution: first to complete payment wins

### 16.3 Offline Mode

- Service worker caches product catalog and pricing for offline access
- Offline sales stored in IndexedDB → synced when connectivity returns
- Offline receipts marked with "pending sync" indicator

---

## 17. Shipping & Tax Engines

### 17.1 Shipping

**Carrier abstraction** (same pattern as payment gateways):

```javascript
class ShippingCarrier {
  async getRates(origin, destination, packages) { /* ... */ }
  async createLabel(shipmentDetails) { /* ... */ }
  async getTracking(trackingNumber) { /* ... */ }
  async cancelShipment(shipmentId) { /* ... */ }
}
```

- Rate calculation at checkout: query carrier APIs in parallel, return options sorted by price/speed
- Tracking: poll carrier APIs periodically or receive webhooks (carrier-dependent)
- Support for local delivery / pickup (no carrier needed — just order status updates)

### 17.2 Tax Engine

**US Sales Tax:**
- Tax rate database: state + county + city + district rates
- Lookup by shipping address zip code → aggregate applicable rates
- Source: periodic import from a tax data provider API or open dataset
- Product tax categories: taxable, exempt, reduced rate (food, clothing in some states)

**Bangladesh VAT:**
- Flat VAT rate applied to applicable products
- Configurable per-tenant for different business types

**Calculation flow:**
```
checkout.calculateTax(cart, shippingAddress) →
  taxService.getApplicableRates(address) →
  apply rates to line items based on product tax category →
  return { taxBreakdown, totalTax }
```

---

## 18. Third-Party Integrations

### 18.1 Integration Framework

```javascript
// integration/connectors/connector.interface.js
class IntegrationConnector {
  async authenticate(credentials) { /* OAuth or API key */ }
  async syncOrders(since) { /* Push orders to external system */ }
  async syncProducts(since) { /* Push product catalog */ }
  async syncCustomers(since) { /* Push customer data */ }
  async handleWebhook(payload) { /* Receive updates from external */ }
  async getStatus() { /* Connection health check */ }
}
```

### 18.2 Connectors

| System | Sync Direction | Data |
|--------|---------------|------|
| **Xero** | Bidirectional | Invoices, payments, expenses |
| **Intuit (QuickBooks)** | Bidirectional | Invoices, sales receipts, customers |

### 18.3 Webhook Outbound System

Merchants can register webhook endpoints to receive events:

```
POST /api/v1/webhooks
{
  "url": "https://merchant-app.com/webhook",
  "events": ["order.placed", "order.fulfilled", "payment.captured"],
  "secret": "auto-generated-hmac-secret"
}
```

Delivery: RabbitMQ consumer → HMAC-sign payload → POST to URL → retry on failure → log delivery status.

---

## 19. Testing Strategy

### 19.1 Test Pyramid

| Layer | Tool | Scope | Target Coverage |
|-------|------|-------|----------------|
| **Unit** | Jest | Service layer, utilities, validators | 80%+ |
| **Integration** | Jest + Supertest | API endpoints with real DB (test container) | Key flows |
| **E2E** | Playwright | Critical user journeys (checkout, POS sale) | Happy paths |

### 19.2 Test Database

- Use Docker test containers — spin up PostgreSQL + Redis + MongoDB per test suite
- Each test suite gets a fresh schema with seed data
- Tests run in transactions that roll back (fast, isolated)

### 19.3 What to Test

- **Always**: Service layer business logic, payment flows, tax calculations, auth flows
- **Integration**: Full API request → response for CRUD operations, webhook delivery
- **E2E**: Checkout flow, POS sale, product search, merchant onboarding
- **Skip**: Simple CRUD controllers with no business logic, third-party SDK wrappers (mock those)

---

## 20. DevOps & Deployment

### 20.1 Local Development

```bash
# One command to start everything
docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up

# Services started:
# - PostgreSQL (5432)
# - MongoDB (27017)
# - Redis (6379)
# - RabbitMQ (5672, management UI on 15672)
# - Elasticsearch (9200)
# - MinIO (9000, console on 9001)
# - API server (3000, with hot reload)
# - Storefront (3001, Next.js dev server)
# - Seller dashboard (3002, Vite dev server)
```

### 20.2 CI Pipeline

```
Push to branch →
  ├── Lint (ESLint + Prettier check)
  ├── Type check (if TypeScript)
  ├── Unit tests (Jest, parallel)
  ├── Integration tests (with test containers)
  ├── Build (all apps + server)
  └── (on main) → Deploy to staging

PR merge to main →
  └── Deploy to production (after staging verification)
```

### 20.3 Production Deployment

- **Container-based**: Docker images built per app/service
- **Database migrations**: Run as a pre-deploy step (not on app startup)
- **Zero-downtime**: Rolling deployment — new containers start before old ones stop
- **Environment config**: All secrets via environment variables (never in code or Docker images)
- **Health checks**: `/health` endpoint on API server — checks DB, Redis, RabbitMQ connectivity

### 20.4 Monitoring

- **Structured logging**: JSON logs via Pino → shipped to log aggregation
- **Metrics**: Response times, error rates, queue depths, cache hit rates
- **Alerts**: Error rate spike, queue backup, DB connection pool exhaustion, disk usage

---

## 21. Security

### 21.1 Application Security

| Measure | Implementation |
|---------|---------------|
| **SQL Injection** | Parameterized queries via query builder (Knex) — never raw string concatenation |
| **XSS** | Content-Security-Policy headers, React's default escaping, DOMPurify for user HTML |
| **CSRF** | SameSite cookies + CSRF token for state-changing requests |
| **Auth** | bcrypt password hashing (cost=12), JWT with short expiry, refresh token rotation |
| **Data Isolation** | PostgreSQL RLS — even a bug in application code can't leak cross-tenant data |
| **File Uploads** | Signed URLs (no file through server), file type validation, size limits |
| **Rate Limiting** | Nginx (global) + Redis sliding window (per-tenant) |
| **Dependencies** | `npm audit` in CI, Dependabot/Renovate for automated updates |
| **Secrets** | Environment variables only — no `.env` files in Docker images or git |

### 21.2 PCI Compliance

- We never store, process, or transmit raw card data
- All payment forms are gateway-hosted (Stripe Elements, SSL-Commerce redirect)
- SAQ A eligible — minimal PCI scope

### 21.3 Data Privacy

- Password hashing with bcrypt
- EXIF stripping on uploaded images
- Soft deletes allow data recovery while supporting "right to delete" requests
- Tenant data fully isolated — no cross-tenant data leakage possible with RLS

---

## 22. Performance & Scalability

### 22.1 Performance Targets

| Metric | Target |
|--------|--------|
| API response (p95) | < 200ms |
| Storefront TTFB (SSR) | < 500ms |
| Search query | < 100ms |
| Product page (LCP) | < 2.5s |
| Checkout completion | < 3s end-to-end |

### 22.2 Scaling Strategy

```
Phase 1 (Launch):
  Single server: API + Workers
  Managed PostgreSQL, Redis, Elasticsearch
  RabbitMQ on same server or managed

Phase 2 (Growth — hundreds of tenants):
  Horizontal API scaling (2-4 instances behind load balancer)
  PostgreSQL read replicas for reporting queries
  Redis cluster for cache capacity
  Dedicated worker servers

Phase 3 (Scale — thousands of tenants):
  PostgreSQL partitioning by tenant_id (Citus or native)
  Elasticsearch cluster (3+ nodes)
  Kafka for high-volume event streaming
  CDN for all static assets + SSR page cache
  Consider extracting hot modules (Payments, Search) into services
```

### 22.3 Database Performance

- **Indexes**: B-tree on all foreign keys, `tenant_id` composite indexes, GIN on `jsonb` columns
- **Connection pooling**: PgBouncer in transaction mode
- **Query monitoring**: `pg_stat_statements` for slow query identification
- **N+1 prevention**: Eager loading via joins in repository layer, dataloader pattern for GraphQL (if added)

---

## 23. Error Handling & Logging

### 23.1 Error Classes

```javascript
class AppError extends Error {
  constructor(message, statusCode, code, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;          // e.g., "PRODUCT_NOT_FOUND"
    this.details = details;     // e.g., validation errors array
    this.isOperational = true;  // vs programming errors
  }
}

class NotFoundError extends AppError {
  constructor(resource, id) {
    super(`${resource} not found`, 404, `${resource.toUpperCase()}_NOT_FOUND`);
  }
}

class ValidationError extends AppError { ... }
class UnauthorizedError extends AppError { ... }
class ForbiddenError extends AppError { ... }
class ConflictError extends AppError { ... }
```

### 23.2 Global Error Handler

```javascript
function errorHandler(err, req, res, next) {
  if (err.isOperational) {
    // Expected errors — return structured response
    logger.warn({ err, requestId: req.id }, err.message);
    return res.status(err.statusCode).json({ error: { code: err.code, message: err.message, details: err.details } });
  }

  // Programming errors — log full stack, return generic 500
  logger.error({ err, requestId: req.id }, 'Unexpected error');
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
}
```

### 23.3 Logging

- **Library**: Pino (fast, structured JSON logs)
- **Log levels**: `trace` → `debug` → `info` → `warn` → `error` → `fatal`
- **Every request logged**: method, path, status, duration, tenant_id, user_id, request_id
- **Correlation**: `x-request-id` header propagated through all internal calls and queue messages

---

## 24. Future Considerations

These are not in scope for the current milestones but the architecture is designed to accommodate them:

| Feature | Architectural Impact | Preparation |
|---------|---------------------|------------|
| **GraphQL API** | Add alongside REST — resolvers call same service layer | Service layer is gateway-agnostic |
| **WebSocket real-time** | Order status, POS sync, live chat | Redis pub/sub already in place |
| **Kafka migration** | Replace RabbitMQ for high-volume events | Event schema is broker-agnostic |
| **Mobile native apps** | Consume same REST API | API-first design |
| **Multi-language (i18n)** | Product titles, UI strings | `jsonb` fields support locale keys |
| **Multi-currency** | Price conversion, currency-specific formatting | `currency` column on orders/products |
| **Marketplace model** | Multiple sellers on one storefront | Tenant model extends to seller-within-tenant |
| **Analytics pipeline** | Event stream → data warehouse | All events already flow through message queue |
| **Service extraction** | Pull hot modules into standalone services | Module boundaries are clean; swap function calls for HTTP/gRPC |

---

*This is a living document. Update as architectural decisions are made during implementation.*
