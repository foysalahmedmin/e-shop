import express from "express";
import cors from "cors";
import proxy from "express-http-proxy";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import initializeSiteConfig from "./libs/initializeSiteConfig";

const app = express();

// Environment-based configuration
const isProduction = process.env.NODE_ENV === "production";

// Production-safe CORS configuration
const allowedOrigins = isProduction
  ? [
      "https://shondhane.com",
      "https://sellers.shondhane.com",
      "https://admin.shondhane.com",
      "http://nginx",
      "http://localhost",
    ]
  : ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"];

app.use(
  cors({
    origin: allowedOrigins,
    allowedHeaders: ["Authorization", "Content-Type", "X-Requested-With"],
    credentials: true,
  })
);

// Use appropriate logging for production
app.use(morgan(isProduction ? "combined" : "dev"));

app.use(express.json({ limit: "50mb" })); // Reduced from 100mb for security
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

// Trust proxy settings for production (behind nginx/load balancer)
app.set("trust proxy", isProduction ? "loopback" : 1);

// Enhanced rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Simplified rate limit - auth should be handled by individual services
  message: { error: "Too many requests, please try again later!" },
  standardHeaders: true,
  legacyHeaders: false, // Disable legacy headers in production
  keyGenerator: (req: any) => req.ip,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === "/gateway-health";
  },
});

app.use(limiter);

// Health check endpoint
app.get("/gateway-health", (req, res) => {
  res.status(200).json({
    message: "API Gateway is healthy!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Service URLs configuration
const getServiceUrl = (serviceName: string, port: number) => {
  if (isProduction) {
    // Use Docker service names in production
    return `http://${serviceName}:${port}`;
  } else {
    // Use localhost for development
    return `http://localhost:${port}`;
  }
};

// Enhanced proxy configuration with error handling
const createProxyMiddleware = (serviceUrl: string, serviceName: string) => {
  return proxy(serviceUrl, {
    timeout: 30000, // 30 second timeout
    proxyReqOptDecorator: (
      proxyReqOpts: { headers: any },
      srcReq: { ip: any; get: (arg0: string) => any }
    ) => {
      // Forward original IP for proper rate limiting in downstream services
      proxyReqOpts.headers!["X-Forwarded-For"] = srcReq.ip;
      proxyReqOpts.headers!["X-Original-Host"] = srcReq.get("host");
      return proxyReqOpts;
    },
    proxyErrorHandler: (
      err: { message: any },
      res: {
        headersSent: any;
        status: (arg0: number) => {
          (): any;
          new (): any;
          json: {
            (arg0: { error: string; service: string; timestamp: string }): void;
            new (): any;
          };
        };
      },
      next: any
    ) => {
      console.error(`Proxy error for ${serviceName}:`, err.message);
      if (!res.headersSent) {
        res.status(503).json({
          error: "Service temporarily unavailable",
          service: serviceName,
          timestamp: new Date().toISOString(),
        });
      }
    },
  });
};

// Route to microservices using Docker service names in production
app.use(
  "/recommendation",
  createProxyMiddleware(
    getServiceUrl("recommendation-service", 6007),
    "recommendation-service"
  )
);

app.use(
  "/chatting",
  createProxyMiddleware(
    getServiceUrl("chatting-service", 6006),
    "chatting-service"
  )
);

app.use(
  "/admin",
  createProxyMiddleware(getServiceUrl("admin-service", 6005), "admin-service")
);

app.use(
  "/order",
  createProxyMiddleware(getServiceUrl("order-service", 6004), "order-service")
);

app.use(
  "/seller",
  createProxyMiddleware(getServiceUrl("seller-service", 6003), "seller-service")
);

app.use(
  "/product",
  createProxyMiddleware(
    getServiceUrl("product-service", 6002),
    "product-service"
  )
);

// Add this before the default route
app.use(
  "/auth",
  createProxyMiddleware(getServiceUrl("auth-service", 6001), "auth-service")
);

// Global error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Global error handler:", err);

    if (!res.headersSent) {
      res.status(500).json({
        error: isProduction ? "Internal server error" : err.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Handle 404s
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
});

const port = process.env.PORT || 8080;
const host = isProduction ? "0.0.0.0" : "localhost";

const server = app.listen(Number(port), host, () => {
  console.log(`🚀 API Gateway listening at http://${host}:${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 CORS Origins: ${JSON.stringify(allowedOrigins)}`);

  try {
    initializeSiteConfig();
    console.log("✅ Site config initialized successfully!");
  } catch (error) {
    console.error("❌ Failed to initialize site config:", error);
  }
});

// Graceful shutdown handling
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("✅ Process terminated");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("✅ Process terminated");
    process.exit(0);
  });
});

server.on("error", (error: any) => {
  console.error("❌ Server error:", error);
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use`);
    process.exit(1);
  }
});
