import { withJob } from "../lib/resource-guard.ts";
import { captureCatalogWatch } from "../lib/watch-run.ts";

const result = await withJob("catalog-watch", "light", () => captureCatalogWatch());
process.stdout.write(result.digest);
