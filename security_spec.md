# CareerLoop Firestore Security Specification

## 1. Data Invariants
1. **Strict Ownership:** Every `/users/{userId}` document, `/users/{userId}/workspaces/{workspaceId}` document, and `/users/{userId}/assessments/{assessmentId}` document is strictly owned by `request.auth.uid == userId`.
2. **Verified Email Mandate:** All Firestore writes (`create`, `update`) require `request.auth != null && request.auth.token.email_verified == true`.
3. **No Privilege or Identity Spoofing:** `uid` inside every document must equal `request.auth.uid` on creation and remain immutable on update.
4. **Temporal Integrity:** `createdAt` must equal `request.time` on creation and remain immutable on update; `updatedAt` must equal `request.time` on creation and every update.
5. **Relational Parent Gate:** Subcollections (`/workspaces/{workspaceId}`, `/assessments/{assessmentId}`) verify that the parent `/users/{userId}` document exists and belongs to `request.auth.uid`.
6. **No Blanket Reads / List Scraping:** `allow list` on `/users` is `false`. Subcollection `allow list` strictly requires `request.auth.uid == userId && resource.data.uid == request.auth.uid`.
7. **Volumetric Bounds:** Every string field enforces `.size()`, and every array (`verifiedSkills`, `skillGaps`, `roadmapNodes`, `roadmapEdges`, `agentLogs`, `claimedSkills`) enforces a strict maximum item count and element shape check.

---

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Vector | Target Path | Adversarial Payload / Condition | Expected Result |
|---|---|---|---|---|
| 1 | Unauthenticated Read | `/users/userA` | `auth == null` on `get` | `PERMISSION_DENIED` |
| 2 | Cross-User Profile Read (PII Leak) | `/users/userB` | `auth.uid == 'userA'` reading `userB` | `PERMISSION_DENIED` |
| 3 | User Collection Scraping | `/users` | `list` query by authenticated `userA` | `PERMISSION_DENIED` |
| 4 | Unverified Email Write | `/users/userA` | `auth.token.email_verified == false` on `create` | `PERMISSION_DENIED` |
| 5 | Identity Spoofing (`uid` mismatch) | `/users/userA` | `{ uid: 'userB', displayName: 'Alice', ... }` | `PERMISSION_DENIED` |
| 6 | Ghost / Shadow Field Injection | `/users/userA` | Extra key `{ isAdmin: true, role: 'admin' }` | `PERMISSION_DENIED` |
| 7 | Timestamp Backdating | `/users/userA` | `createdAt: Timestamp(2020-01-01)` instead of `request.time` | `PERMISSION_DENIED` |
| 8 | Immutable Field Tampering | `/users/userA` | `update` changing `createdAt` or `uid` | `PERMISSION_DENIED` |
| 9 | Path ID Poisoning | `/users/../../admins` or 1.5KB ID | Malformed/oversized `{userId}` or `{workspaceId}` | `PERMISSION_DENIED` |
| 10 | Value Poisoning (Oversized String) | `/users/userA` | `targetRole` > 80 chars or `displayName` > 100 chars | `PERMISSION_DENIED` |
| 11 | Orphaned Subcollection Write | `/users/userA/workspaces/primary` | Creating workspace when parent `/users/userA` does not exist | `PERMISSION_DENIED` |
| 12 | Array / Denial-of-Wallet Exhaustion | `/users/userA/workspaces/primary` | `agentLogs` array with > 30 elements or invalid element type | `PERMISSION_DENIED` |
