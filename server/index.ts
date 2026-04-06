import { createApp } from "./app.js";
import path from "node:path";

const rootDir = process.cwd();
const port = Number(process.env.PORT ?? 3000);
const dbPath = process.env.SQLITE_PATH ?? path.join(rootDir, "data", "app.db");
const clientDistPath =
  process.env.NODE_ENV === "production"
    ? path.join(rootDir, "dist", "client")
    : undefined;

const { app } = createApp({ dbPath, clientDistPath });

app.listen(port, () => {
  console.log(`Relay Tasks running on http://localhost:${port}`);
});
