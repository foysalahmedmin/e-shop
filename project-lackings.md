# Project Analysis: E-shop Microservices Platform

This document outlines the major architectural, operational, and security lackings identified in the current state of the project. While the project demonstrates a sophisticated microservices setup with Nx, Kafka, and Next.js, several critical areas require attention to achieve production-grade maturity.

## 1. Architectural Lackings

### 1.1. Improper Data Modeling (Excessive Document Nesting)

- **Status**: Critical
- **Observation**: Many data models (e.g., `shops`, `analytics`, `orders`) rely heavily on nested JSON objects or Arrays to store bulk data instead of using normalized relational structures. Data is embedded within a single document rather than being logically separated.
- **Implication**:
  - **Maintainability**: Modifying or updating specific parts of nested data becomes increasingly complex and error-prone as the system grows.
  - **Data Analysis Issues**: Querying and profiling nested data for analytics is significantly slower and more complex compared to flat, relational structures.
  - **Query Inefficiency**: To retrieve even a small piece of information, the entire large document must be loaded into memory, leading to unnecessary I/O and memory overhead.
  - **Relationship Complexity**: Managing Many-to-Many relationships inside arrays makes bi-directional querying and data integrity enforcement extremely difficult.
- **Recommendation**: Decompose bulk nested data into normalized relational models stored in separate collections/tables. Use proper Many-to-Many relations where appropriate to ensure a cleaner, searchable, and more maintainable data structure.

### 1.2. Shared Database (Distributed Monolith)

- **Status**: Critical
- **Observation**: All services share a single `schema.prisma` file and a single MongoDB database instance.
- **Implication**: Services are tightly coupled at the data layer. A schema change for one service can break others. Scaling individual services' databases (e.g., high-read product service vs high-write order service) is impossible.
- **Recommendation**: Implement **Database per Service**. Each service should own its schema and data. Cross-service data requirements should be handled via Kafka events or API calls.

### 1.3. Absence of Event-Driven Data Synchronization

- **Status**: Critical
- **Observation**: Although Kafka is integrated into the project, it is currently used only for **Log Management**. There is no mechanism to fire domain events (e.g., `UserCreated`, `ProductUpdated`, `OrderPlaced`) and synchronize data across other services.
- **Implication**:
  - **Data Blindness**: If the database is separated (Database per Service), one service will not be able to "see" or access another service's data.
  - **Inconsistent State**: Updates in one service are not reflected in others, leading to data inconsistency in a distributed system.
  - **Tight Coupling**: This will create a significant bottleneck when scaling or adding new services in the future.
- **Recommendation**: Implement a true **Event-Driven Architecture (EDA)**. Every major state change (CRUD) should publish an event to Kafka, and relevant services should have consumers to sync that data into their own local databases.

### 1.4. Expensive Recommendation Logic

- **Status**: Major (Performance)
- **Observation**: The `recommendation-service` trains a TensorFlow.js model within the request-response cycle.
- **Implication**: Training is CPU-intensive and blocks the Node.js event loop. As the user base grows, this service will become a major bottleneck and crash under load.
- **Recommendation**: Move model training to a background worker or a periodic cron job. Stores the trained weights and use the service only for **inference**.

### 1.5. Authentication Redundancy & DB Load

- **Status**: Major (Performance)
- **Observation**: The API Gateway acts as a simple proxy and does not validate tokens. Every downstream service re-implements `isAuthenticated`, performing a database lookup (`prisma.users.findUnique`) for every protected request.
- **Implication**: Massive redundant load on the database and increased latency for every authenticated API call.
- **Recommendation**: Implement **Global Auth at Gateway**. The Gateway should verify the JWT and inject user information into headers (e.g., `x-user-id`, `x-user-role`). Downstream services should trust these headers.

### 1.6. Inflexible Service Discovery

- **Status**: Minor/Moderate (Scaling)
- **Observation**: Service URLs (e.g., `http://localhost:6001`) are hardcoded in the `api-gateway` and other configurations.
- **Implication**: Adding instances or changing infrastructure requires manual code updates.
- **Recommendation**: Use a service discovery mechanism (Consul, Etcd) or rely on Kubernetes DNS if deploying to K8s.

---

## 2. Business Logic & Industry Standard Lackings

### 2.1. Price Tampering Vulnerability

- **Status**: Critical (Security/Financial)
- **Observation**: `order-service` calculates the total checkout amount using prices sent directly from the frontend request body (`req.body.cart`).
- **Implication**: A malicious user can intercept the request and change the `sale_price` of a high-value item to \$1, and the system will process the payment at that price.
- **Recommendation**: Never trust prices from the frontend. The backend must re-fetch prices from the database using the product IDs provided in the cart before calculating the total and creating a payment session.

### 2.2. Lack of Inventory Reservation & Race Conditions

- **Status**: Major (Operational)
- **Observation**: Stock is decremented in `order-service` _after_ a successful payment webhook from Stripe. There is no temporary stock reservation during the checkout process.
- **Implication**: Two users can simultaneously pay for the last remaining item. The system will charge both, but one will eventually find the item out of stock when the webhook tries to decrement it, leading to refund nightmares and poor UX.
- **Recommendation**: Implement a **Stock Reservation** system (using Redis or a dedicated table) where items are held for 10-15 minutes when a user enters the checkout flow.

### 2.3. Distributed Transaction Inconsistency

- **Status**: Major (Data Integrity)
- **Observation**: The `createOrder` webhook handler performs multiple independent database operations (Create Order, Update Stock, Update Analytics, Create Notifications) without a unified transaction.
- **Implication**: If the server crashes after creating the order but before updating the stock, the inventory will become out of sync, leading to "ghost stock" or overselling.
- **Recommendation**: Use **Prisma Transactions** for atomic operations. In a true microservice environment, implement the **Saga Pattern** or **Outbox Pattern** to ensure consistency across services.

### 2.4. Rigid Order Lifecycle (Missing State Machine)

- **Status**: Moderate
- **Observation**: Order status transitions are handled via simple string updates without validation logic.
- **Implication**: There are no guards to prevent invalid state jumps (e.g., from "Ordered" directly to "Delivered" without "Shipped"). Also, logic for "Cancelled", "Refunded", or "Returned" is either missing or incomplete.
- **Recommendation**: Implement a formal **State Machine** for order statuses with defined transition rules and side effects (e.g., auto-restoring stock on cancellation).

### 2.5. Fragile Webhook Dependency

- **Status**: Moderate (Reliability)
- **Observation**: Order creation relies entirely on the successful delivery of the Stripe Webhook.
- **Implication**: If the webhook delivery fails (network issue, server downtime), the customer is charged, but the order is never created in the database, resulting in manual reconciliation and customer support overhead.
- **Recommendation**: Create "Pending" orders _before_ payment. Use the webhook only to update the status to "Paid". Implement a background cron job to reconcile unpaid/stuck orders.

---

## 3. Security Lackings

### 3.1. Secret Management

- **Status**: Moderate
- **Observation**: Secrets are stored in plain text `.env` files.
- **Implication**: Elevated risk of credential leakage.
- **Recommendation**: Use encrypted secrets or environmental injection via CI/CD pipelines.

### 3.2. Rate Limiting Granularity

- **Status**: Minor
- **Observation**: Rate limiting is only at the Gateway level and is quite permissive.
- **Implication**: Individual services are vulnerable to internal flooding or targeted attacks if the gateway is bypassed.
- **Recommendation**: Implement service-level rate limiting for critical endpoints (e.g., Login, Order Placement).

---

## 4. Development & Quality Lackings

### 4.1. Test Coverage

- **Status**: Major
- **Observation**: The project lacks unit tests for core business logic in most services. Only one E2E test project exists.
- **Implication**: High risk of regressions during refactoring or feature additions.
- **Recommendation**: Aim for at least 70% coverage on controllers and services using Vitest or Jest.

### 4.2. Search Scalability

- **Status**: Moderate
- **Observation**: Product search appears to rely on basic database queries.
- **Implication**: Poor performance and lack of advanced features (fuzzy search, relevance ranking) as the product catalog grows.
- **Recommendation**: Integrate a dedicated search engine like Elasticsearch or Meilisearch.

### 4.3. Documentation

- **Status**: Minor
- **Observation**: README is good for setup but lacks architectural diagrams and API contracts for inter-service communication.
- **Recommendation**: Add a `docs/` folder with Mermaid diagrams and centralized OpenAPI/Swagger documentation for all services.

---

## 5. DevOps & Infrastructure Lackings

### 5.1. Shared Configuration Risk

- **Status**: Major (Security/Operational)
- **Observation**: All services in `docker-compose.production.yml` load the same `.env` file via `env_file`.
- **Implication**: Every service has access to every other service's secrets (e.g., `STRIPE_SECRET_KEY` in `logger-service`).
- **Recommendation**: Use service-specific environment variables or a secret management tool (HashiCorp Vault, AWS Secrets Manager).

### 5.2. Incomplete Production Orchestration

- **Status**: Major (Operational)
- **Observation**: `docker-compose.production.yml` is missing the MongoDB service definition and Redis (which is mentioned in the README).
- **Implication**: The production environment is not "one-click" and relies on external, undocumented database setups.
- **Recommendation**: Include all infrastructure dependencies (Redis, DB migrants) in the orchestration files or provide clear documentation for managed services.

### 5.3. Monitoring & Observability

- **Status**: Moderate
- **Observation**: While a `logger-service` exists, there is no centralized log visualization (like ELK or Grafana Loki) or metrics collection (Prometheus).
- **Implication**: Debugging issues across 10+ services during a production outage will be extremely difficult.
- **Recommendation**: Integrate OpenTelemetry for distributed tracing and set up a Grafana dashboard for service health.
