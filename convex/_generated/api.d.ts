/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as applications from "../applications.js";
import type * as auth from "../auth.js";
import type * as employers from "../employers.js";
import type * as functions from "../functions.js";
import type * as http from "../http.js";
import type * as inboundMessages from "../inboundMessages.js";
import type * as inngest_client from "../inngest/client.js";
import type * as inngest_handler from "../inngest/handler.js";
import type * as inngest_index from "../inngest/index.js";
import type * as inngest_processApplication from "../inngest/processApplication.js";
import type * as inngest_processJob from "../inngest/processJob.js";
import type * as inngestNode from "../inngestNode.js";
import type * as jobSubmissions from "../jobSubmissions.js";
import type * as lib_circle from "../lib/circle.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_env from "../lib/env.js";
import type * as lib_jobSchema from "../lib/jobSchema.js";
import type * as lib_slack from "../lib/slack.js";
import type * as lib_token from "../lib/token.js";
import type * as lib_twilio from "../lib/twilio.js";
import type * as lib_utils from "../lib/utils.js";
import type * as migrations from "../migrations.js";
import type * as myFunctions from "../myFunctions.js";
import type * as oauth from "../oauth.js";
import type * as profileWebhook from "../profileWebhook.js";
import type * as profiles from "../profiles.js";
import type * as referrals from "../referrals.js";
import type * as resumes from "../resumes.js";
import type * as scrapedJobs from "../scrapedJobs.js";
import type * as scrapedJobsSearch from "../scrapedJobsSearch.js";
import type * as senders from "../senders.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  applications: typeof applications;
  auth: typeof auth;
  employers: typeof employers;
  functions: typeof functions;
  http: typeof http;
  inboundMessages: typeof inboundMessages;
  "inngest/client": typeof inngest_client;
  "inngest/handler": typeof inngest_handler;
  "inngest/index": typeof inngest_index;
  "inngest/processApplication": typeof inngest_processApplication;
  "inngest/processJob": typeof inngest_processJob;
  inngestNode: typeof inngestNode;
  jobSubmissions: typeof jobSubmissions;
  "lib/circle": typeof lib_circle;
  "lib/crypto": typeof lib_crypto;
  "lib/env": typeof lib_env;
  "lib/jobSchema": typeof lib_jobSchema;
  "lib/slack": typeof lib_slack;
  "lib/token": typeof lib_token;
  "lib/twilio": typeof lib_twilio;
  "lib/utils": typeof lib_utils;
  migrations: typeof migrations;
  myFunctions: typeof myFunctions;
  oauth: typeof oauth;
  profileWebhook: typeof profileWebhook;
  profiles: typeof profiles;
  referrals: typeof referrals;
  resumes: typeof resumes;
  scrapedJobs: typeof scrapedJobs;
  scrapedJobsSearch: typeof scrapedJobsSearch;
  senders: typeof senders;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
