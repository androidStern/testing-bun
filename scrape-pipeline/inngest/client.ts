import { Inngest, EventSchemas } from "inngest";
import type { SnagajobJob } from "../scrapers/snagajob";

// Event types for type safety
type Events = {
  "batch/process": {
    data: {
      jobs: SnagajobJob[];
      source: string;
    };
  };
  "jobs/reindex-all": {
    data: {
      reason?: string;
    };
  };
  "fair-chance/refresh": {
    data: {
      reason?: string;
    };
  };
};

export const inngest = new Inngest({
  id: "scrape-jobs",
  schemas: new EventSchemas().fromRecord<Events>(),
  isDev: process.env.NODE_ENV !== "production",
});
