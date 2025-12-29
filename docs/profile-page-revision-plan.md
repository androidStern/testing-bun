# Profile Page Revision Plan

## Current State Analysis

### Problems

1. **Conflates onboarding and profile management**
   - Same `ProfileForm` component handles both new user setup and profile editing
   - After save, shows static "Profile Saved!" message with no way to edit further
   - No persistent profile view - just the form

2. **Missing optional fields from the form**
   - The ProfileForm only shows 3 required fields (thingsICanOffer, headline, bio)
   - Optional fields (resumeLink, location, website, linkedinUrl, instagramUrl) exist in schema but aren't rendered in the form
   - Location is a simple text field, not the new GPS-based HomeLocation

3. **No profile summary/display mode**
   - Users can't see their profile as others might see it
   - No visual feedback of what's saved (except brief success state)

4. **Poor information hierarchy**
   - ReferralCard is below the form, disconnected
   - No logical grouping of related information

### Current Component Structure

```
HomeContent
├── Header (brand + UserMenu)
├── AuthDebug (dev only)
├── main
│   ├── <Authenticated>
│   │   ├── ProfileForm (large form, shows success state on save)
│   │   └── ReferralCard (in Suspense)
│   └── <Unauthenticated>
│       └── SignInForm
```

---

## Proposed Revision

### New Structure

Transform the page into a proper **profile dashboard** with distinct sections:

```
HomeContent
├── Header (brand + UserMenu)
├── main
│   ├── <Authenticated>
│   │   └── ProfileDashboard
│   │       ├── ProfileHeader (name, headline, HomeLocation)
│   │       ├── ProfileCard (view/edit bio, links)
│   │       ├── GoalsCard (thingsICanOffer - what brings you here)
│   │       └── ReferralCard (existing)
│   └── <Unauthenticated>
│       └── SignInForm (existing)
```

### Key Changes

1. **Split ProfileForm into focused components:**
   - `ProfileHeader` - Name, headline, home location display
   - `ProfileCard` - Bio and optional links with inline editing
   - `GoalsCard` - "What brings you here" checkboxes

2. **Add HomeLocation prominently:**
   - Show in ProfileHeader section with city name
   - "Set Home Location" button triggers GPS
   - Shows "(computing transit zones...)" while processing

3. **Card-based layout:**
   - Each section is a distinct card
   - Consistent spacing and visual hierarchy
   - Edit buttons on each card for focused updates

4. **Preserve all existing functionality:**
   - Same form validation logic
   - Same AI polish for bio
   - Same referral tracking
   - Same authentication flow

---

## Implementation Plan

### Phase 1: Add HomeLocation to existing ProfileForm (minimal change)

Rather than a full refactor, integrate HomeLocation into the current structure first:

**File: `src/routes/index.tsx`**

```diff
 <Authenticated>
   {user && (
     <div className="space-y-6">
       <ProfileForm user={user} referredByCode={referralCode ?? undefined} />
-      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
+      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
+        <HomeLocationCard workosUserId={user.id} />
         <Suspense fallback={null}>
           <ReferralCard workosUserId={user.id} />
         </Suspense>
       </div>
     </div>
   )}
 </Authenticated>
```

**New component: `HomeLocationCard`**

A card wrapper around the existing `HomeLocation` component:

```tsx
function HomeLocationCard({ workosUserId }: { workosUserId: string }) {
  return (
    <div className="bg-gradient-to-br from-blue-500/5 to-cyan-500/5 rounded-2xl p-6 border border-blue-500/10">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🗺️</span>
        <h3 className="font-semibold text-lg text-foreground">Home Location</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Set your home location to find jobs accessible by public transit.
      </p>
      <HomeLocation workosUserId={workosUserId} />
    </div>
  );
}
```

### Phase 2: Add optional fields to ProfileForm (future)

Expand the form to include the missing optional fields:
- Resume Link (URL input)
- Website (URL input)
- LinkedIn URL (URL input)
- Instagram URL (URL input)

These exist in the schema but aren't currently rendered.

### Phase 3: Card-based profile dashboard (future)

Full refactor to the card-based layout described above. This is a larger change that should be done separately.

---

## Files to Modify (Phase 1)

| File | Change |
|------|--------|
| `src/routes/index.tsx` | Add HomeLocationCard between ProfileForm and ReferralCard |
| `src/components/HomeLocation.tsx` | Already created - no changes needed |

---

## Visual Layout (Phase 1)

```
┌─────────────────────────────────────────┐
│  Recovery Jobs                [Sign out]│
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Complete Your Profile           │    │
│  │                                 │    │
│  │ What brings you here? *         │    │
│  │ [✓] To find a job               │    │
│  │ [ ] To lend a hand              │    │
│  │ ...                             │    │
│  │                                 │    │
│  │ Most Recent Position *          │    │
│  │ [___________________________]   │    │
│  │                                 │    │
│  │ Professional Summary * [Polish] │    │
│  │ [___________________________]   │    │
│  │                                 │    │
│  │ [Save & Continue]               │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 🗺️ Home Location                │    │
│  │                                 │    │
│  │ Set your home location to find  │    │
│  │ jobs accessible by transit.     │    │
│  │                                 │    │
│  │ 📍 Miami    [Update]            │    │
│  │ (computing transit zones...)    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 🔗 Invite Friends               │    │
│  │                                 │    │
│  │ Share your invite link...       │    │
│  │                                 │    │
│  │ [recoveryjobs.com/join/ABC123]  │    │
│  │ [Copy]                          │    │
│  │                                 │    │
│  │ 5 people joined with your link  │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

---

## Implementation Notes

1. **HomeLocation is independent of ProfileForm**
   - Uses its own mutation (`setHomeLocation`)
   - Doesn't require profile form submission
   - Can be set/updated at any time after profile exists

2. **Show HomeLocationCard only if profile exists**
   - The `setHomeLocation` mutation requires an existing profile
   - Only show the card after the user has saved their profile at least once

3. **Consider loading states**
   - HomeLocation has its own loading state
   - Wrap in Suspense for cleaner loading

4. **Mobile-first design**
   - Cards stack vertically
   - Full-width buttons on mobile
   - Touch-friendly tap targets
