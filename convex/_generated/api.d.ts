/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as functions from "../functions.js";
import type * as http from "../http.js";
import type * as inboundMessages from "../inboundMessages.js";
import type * as inngest from "../inngest.js";
import type * as migrations from "../migrations.js";
import type * as myFunctions from "../myFunctions.js";
import type * as oauth from "../oauth.js";
import type * as profiles from "../profiles.js";
import type * as referrals from "../referrals.js";
import type * as resumes from "../resumes.js";
import type * as senders from "../senders.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  functions: typeof functions;
  http: typeof http;
  inboundMessages: typeof inboundMessages;
  inngest: typeof inngest;
  migrations: typeof migrations;
  myFunctions: typeof myFunctions;
  oauth: typeof oauth;
  profiles: typeof profiles;
  referrals: typeof referrals;
  resumes: typeof resumes;
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
