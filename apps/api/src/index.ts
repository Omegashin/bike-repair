import { createApp } from "./app.ts";

const port = Number(process.env.PORT ?? 3000);
createApp({ webDir: process.env.WEB_DIST_DIR }).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
