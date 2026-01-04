# Auth Security Audit - Remaining Work

## Problem

Public mutations and queries accept `workosUserId` as an argument, allowing any authenticated user to act on behalf of other users. This is a security vulnerability.

## Scope

This document tracks the remaining work after the initial fix for `collectResume` tool.

## Completed

- [x] `convex/resumes.ts` - Added `upsertOwn` mutation that uses auth instead of accepting `workosUserId`
- [x] `src/components/resume/ResumeUploadCard.tsx` - Refactored to use `useAuth()` internally

## Remaining Convex Functions to Fix

### High Priority (Mutations - Security Risk)

| File | Function | Current Issue | Fix |
|------|----------|---------------|-----|
| `convex/resumes.ts` | `upsert` | Accepts `workosUserId` | Mark deprecated, use `upsertOwn` |
| `convex/profiles.ts` | `create` | Accepts `workosUserId`, validates but redundant | Use auth directly |
| `convex/profiles.ts` | `update` | Accepts `workosUserId`, validates but redundant | Use auth directly |

### Medium Priority (Queries - Data Exposure)

| File | Function | Current Issue | Fix |
|------|----------|---------------|-----|
| `convex/resumes.ts` | `getByWorkosUserId` | Any user can read any resume | Create auth-based `getOwn`, make this internal |
| `convex/profiles.ts` | `getByWorkosUserId` | Any user can read any profile | Evaluate if profile data is intentionally public |
| `convex/referrals.ts` | `getMyReferralStats` | Accepts `workosUserId` despite "My" in name | Use auth directly |

### Low Priority (Need Investigation)

| File | Notes |
|------|-------|
| `convex/oauth.ts` | Multiple `workosUserId` references - need to understand OAuth flow requirements |

## Remaining Frontend Components to Fix

| Component | Current Issue | Fix |
|-----------|---------------|-----|
| `src/components/HomeLocationCard.tsx` | `workosUserId` prop | Use `useAuth()` |
| `src/components/JobMatcher.tsx` | `workosUserId` prop | Use `useAuth()` |
| `src/components/ReferralCard.tsx` | `workosUserId` prop | Use `useAuth()` |
| `src/components/ProfileForm.tsx` | Passes `user.id` to mutation | Use auth-based mutation |
| `src/components/ResumeForm.tsx` | Passes `user.id` to mutation | Use auth-based mutation |

## Schema Changes

| File | Change |
|------|--------|
| `src/lib/schemas/resume.ts` | Remove `workosUserId` from `resumeMutationSchema` after migration |
| `src/lib/schemas/profile.ts` | Remove `workosUserId` from `profileMutationSchema` after migration |

## Documentation Updates

Update `convex/AGENTS.md` to add AUTH RULES section documenting:
- Never accept `workosUserId` as public function argument
- When `workosUserId` in args IS acceptable (internal functions, admin functions)
- Auth pattern cheatsheet

## Migration Strategy

1. Add auth-based alternatives (`*Own` suffix) alongside existing functions
2. Update frontend to use new functions
3. Mark old functions as deprecated
4. After confirming no usage, remove deprecated functions
