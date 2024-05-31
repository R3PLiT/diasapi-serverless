import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import createError from "http-errors";
import connectToDatabase from "./services/connectMongo.js";
import { connectEthereum } from "./services/connectEthers.js";
import allRoutes from "./routes/allRoutes.js";
import errorHandler from "./middlewares/errorMiddleware.js";
import { registerFont } from "canvas";

const app = express();
const port = process.env.PORT || 3030;

app.use(cors());
app.disable("x-powered-by");
app.use(helmet());
app.use(compression());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Connect to MongoDB Atlas
try {
  await connectToDatabase();
} catch (error) {
  console.error("Database connection error:", error);
  process.exit(1);
}

// Connect to Ethereum Sepolia
try {
  await connectEthereum();
} catch (error) {
  console.error("Initializing Ethereum error:", error);
}

registerFont("api/includes/templates/fonts/THSarabun Bold.ttf", { family: "Bold" });
registerFont("api/includes/templates/fonts/THSarabun.ttf", { family: "Normal" });

// Routes
app.use("/", allRoutes);

// Handling undefined routes
app.use((req, res, next) => {
  return next(createError(404, "Page not Found"));
  // return next(createError(404));
});

// Error handling middleware
app.use(errorHandler);

app.listen(port, () => {
  console.log(`App listening at port:${port}`);
});
