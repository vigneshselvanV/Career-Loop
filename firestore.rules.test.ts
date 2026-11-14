import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const RULES_PATH = path.resolve(process.cwd(), 'firestore.rules');
const rulesContent = fs.readFileSync(RULES_PATH, 'utf8');

test('Dirty Dozen #1 & #3: Default-deny safety net and users collection list disabled', () => {
  assert.match(rulesContent, /match \/\{document=\*\*\}[\s\S]*allow read, write: if false;/);
  assert.match(rulesContent, /match \/users\/\{userId\}[\s\S]*allow list: if false;/);
});

test('Dirty Dozen #2: Strict ownership checks on users, workspaces, and assessments', () => {
  assert.match(rulesContent, /allow get: if isSignedIn\(\)[\s\S]*request\.auth\.uid == userId/);
  assert.match(rulesContent, /match \/workspaces\/\{workspaceId\}[\s\S]*request\.auth\.uid == userId/);
  assert.match(rulesContent, /match \/assessments\/\{assessmentId\}[\s\S]*request\.auth\.uid == userId/);
});

test('Dirty Dozen #4: Verified email mandate enforced for all mutations', () => {
  assert.match(
    rulesContent,
    /function isVerifiedUser\(\)\s*\{\s*return isSignedIn\(\) && request\.auth\.token\.email_verified == true;/
  );
  assert.match(rulesContent, /allow create: if isVerifiedUser\(\)/);
  assert.match(rulesContent, /allow update: if isVerifiedUser\(\)/);
});

test('Dirty Dozen #5 & #6: Identity spoofing & shadow field injection prevented via hasAll/hasOnly', () => {
  assert.match(rulesContent, /data\.uid == request\.auth\.uid/);
  assert.match(rulesContent, /data\.keys\(\)\.hasAll\(/);
  assert.match(rulesContent, /data\.keys\(\)\.hasOnly\(/);
  assert.match(rulesContent, /incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasOnly\(/);
});

test('Dirty Dozen #7 & #8: Timestamp backdating and immutable field tampering blocked', () => {
  assert.match(rulesContent, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rulesContent, /incoming\(\)\.updatedAt == request\.time/);
  assert.match(rulesContent, /incoming\(\)\.createdAt == existing\(\)\.createdAt/);
  assert.match(rulesContent, /incoming\(\)\.uid == existing\(\)\.uid/);
});

test('Dirty Dozen #9 & #10: Path ID regex and string length bounds enforced', () => {
  assert.match(
    rulesContent,
    /function isValidId\(id\)\s*\{\s*return id is string && id\.size\(\) > 0 && id\.size\(\) <= 128 && id\.matches\('\^\[a-zA-Z0-9_\\\\-\]\+\$'\);/
  );
  assert.match(rulesContent, /data\.displayName\.size\(\) <= 100/);
  assert.match(rulesContent, /data\.targetRole\.size\(\) <= 80/);
  assert.match(rulesContent, /data\.topic\.size\(\) <= 120/);
});

test('Dirty Dozen #11: Subcollections enforce parent user existence and ownership', () => {
  assert.match(
    rulesContent,
    /exists\(\/databases\/\$\(database\)\/documents\/users\/\$\(userId\)\)/
  );
  assert.match(
    rulesContent,
    /get\(\/databases\/\$\(database\)\/documents\/users\/\$\(userId\)\)\.data\.uid == request\.auth\.uid/
  );
});

test('Dirty Dozen #12: Array volumetric caps enforced on workspace collections', () => {
  assert.match(rulesContent, /data\.verifiedSkills\.size\(\) <= 30/);
  assert.match(rulesContent, /data\.skillGaps\.size\(\) <= 30/);
  assert.match(rulesContent, /data\.roadmapNodes\.size\(\) <= 30/);
  assert.match(rulesContent, /data\.roadmapEdges\.size\(\) <= 50/);
  assert.match(rulesContent, /data\.agentLogs\.size\(\) <= 40/);
});
