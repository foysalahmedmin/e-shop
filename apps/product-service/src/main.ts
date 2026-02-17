import express from "express";
import productRoutes from "./routes/product.routes";
import cookieParser from "cookie-parser";
import { errorMiddleware } from "@packages/error-handler/error-middleware";

const app: express.Application = express();
app.use(express.json({ limit: "50mb" })); // Reduced from 100mb for security
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({ message: "Product service is running" });
});

app.use("/api", productRoutes);

app.use(errorMiddleware);
const port = process.env.PORT || 6002;
app.listen(port, () => {
  console.log(`Product service is running at http://localhost:${port}/api`);
  console.log(`Swagger Docs available at http://localhost:${port}/docs`);
});

export default app;
