import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GovernmentIdAttemptTracker,
  getGovernmentIdErrorPresentation,
  getGovernmentIdRejectionPresentation,
  getRetakeSides,
  validateGovernmentIdFile,
} from '../src/utils/governmentIdVerificationPresentation.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');
const sectionContent = fs.readFileSync(
  path.join(srcDir, 'components/profile/GovernmentIdSection.tsx'),
  'utf8'
);
const profilePageContent = fs.readFileSync(
  path.join(srcDir, 'pages/dashboard/ProfilePage.tsx'),
  'utf8'
);
const apiContent = fs.readFileSync(
  path.join(srcDir, 'api/governmentIdVerification.ts'),
  'utf8'
);
const requestWizardContent = fs.readFileSync(
  path.join(srcDir, 'pages/dashboard/SacramentalRequestPage.tsx'),
  'utf8'
);
const schedulerContent = fs.readFileSync(
  path.join(srcDir, 'pages/dashboard/EventSchedulerPage.tsx'),
  'utf8'
);

const businessCases = [
  {
    reason: 'IMAGE_BLURRY',
    title: 'ID Photo Unclear',
    message:
      "We couldn't read the ID clearly. Retake the affected photo with the card flat, fully visible, and in clear lighting.",
  },
  {
    reason: 'FRONT_BACK_INCOMPLETE',
    title: 'Front and Back Required',
    message:
      "We couldn't verify both sides of the ID. Make sure the front and back photos are different and clearly show both sides of the same ID.",
  },
  {
    reason: 'NAME_MISMATCH',
    title: 'Name Does Not Match',
    message:
      'The name on the ID does not match your registered TESTIMONIUM profile name.',
  },
  {
    reason: 'ID_EXPIRED',
    title: 'ID Appears Expired',
    message:
      'This ID appears to be expired. Please use a valid, unexpired supported ID.',
  },
  {
    reason: 'UNSUPPORTED_OR_INVALID_DOCUMENT',
    title: 'ID Could Not Be Recognized',
    message:
      "We couldn't recognize this as one of the supported Government IDs. Please use a PhilSys / National ID, Driver's License, UMID, Voter ID, or Postal ID and make sure the document is clearly visible.",
  },
];

const sideCases = [
  {
    issue: 'BOTH_APPEAR_FRONT',
    title: 'Back Side Needed',
    message:
      'Both photos appear to show the front of the ID. Retake the back side of your Government ID.',
    target: 'back',
  },
  {
    issue: 'BOTH_APPEAR_BACK',
    title: 'Front Side Needed',
    message:
      'Both photos appear to show the back of the ID. Retake the front side of your Government ID.',
    target: 'front',
  },
  {
    issue: 'FRONT_IS_BACK',
    title: 'Front Side Needed',
    message:
      'The photo submitted as the front appears to show the back of the ID.',
    target: 'front',
  },
  {
    issue: 'BACK_IS_FRONT',
    title: 'Back Side Needed',
    message:
      'The photo submitted as the back appears to show the front of the ID.',
    target: 'back',
  },
  {
    issue: 'SIDES_SWAPPED',
    title: 'Front and Back Are Reversed',
    message:
      'The front and back photos appear to be reversed. Retake them in the correct order.',
    target: 'both',
  },
];

const applyRetakeTarget = (pair, target) => {
  const sides = getRetakeSides(target);
  return {
    front: sides.includes('front') ? null : pair.front,
    back: sides.includes('back') ? null : pair.back,
  };
};

test('canonical business rejections use Android-safe titles, messages, and retake actions', () => {
  for (const expected of businessCases) {
    const presentation = getGovernmentIdRejectionPresentation(expected.reason);
    assert.deepEqual(presentation, {
      kind: 'BUSINESS_REJECTION',
      title: expected.title,
      message: expected.message,
      action: 'retake',
      retakeTarget: 'both',
    });
  }

  const targetedBlur = getGovernmentIdRejectionPresentation(
    'IMAGE_BLURRY',
    'front'
  );
  assert.equal(targetedBlur.retakeTarget, 'front');
  assert.doesNotMatch(
    getGovernmentIdRejectionPresentation(
      'UNSUPPORTED_OR_INVALID_DOCUMENT'
    ).message,
    /fake|fraud|counterfeit|forged|inauthentic/i
  );
});

test('backend side issues map to exact targeted correction presentations', () => {
  for (const expected of sideCases) {
    const presentation = getGovernmentIdRejectionPresentation(
      'FRONT_BACK_INCOMPLETE',
      null,
      expected.issue
    );
    assert.deepEqual(presentation, {
      kind: 'BUSINESS_REJECTION',
      title: expected.title,
      message: expected.message,
      action: 'retake',
      retakeTarget: expected.target,
    });
  }

  assert.deepEqual(
    getGovernmentIdRejectionPresentation(
      'FRONT_BACK_INCOMPLETE',
      null,
      null
    ).retakeTarget,
    'both'
  );
});

test('targeted replacement retains only the unaffected side', () => {
  const front = { name: 'front.jpg' };
  const back = { name: 'back.jpg' };
  const pair = { front, back };

  assert.deepEqual(applyRetakeTarget(pair, 'back'), {
    front,
    back: null,
  });
  assert.deepEqual(applyRetakeTarget(pair, 'front'), {
    front: null,
    back,
  });
  assert.deepEqual(applyRetakeTarget(pair, 'both'), {
    front: null,
    back: null,
  });
});

test('transport, timeout, infrastructure, concurrency, rate limit, and unknown failures map safely', () => {
  assert.deepEqual(getGovernmentIdErrorPresentation(new TypeError('fetch failed')), {
    kind: 'CONNECTION',
    title: 'Connection Problem',
    message:
      'Unable to connect to TESTIMONIUM. Check your internet connection and try again.',
    action: 'retry',
  });

  const temporary = {
    kind: 'TEMPORARY',
    title: 'Verification Temporarily Unavailable',
    message:
      "We couldn't process your ID right now. Your ID was not rejected. Please try again.",
    action: 'retry',
  };
  assert.deepEqual(
    getGovernmentIdErrorPresentation({ kind: 'TIMEOUT' }),
    temporary
  );
  assert.deepEqual(
    getGovernmentIdErrorPresentation({ statusCode: 503 }),
    temporary
  );
  for (const code of [
    'OCR_SERVICE_UNAVAILABLE',
    'OCR_PROVIDER_UNAVAILABLE',
    'OCR_UPSTREAM_ERROR',
    'OCR_TIMEOUT_OR_UNAVAILABLE',
    'IDENTITY_STORAGE_UNAVAILABLE',
    'STORAGE_ERROR',
    'IDENTITY_PERSISTENCE_ERROR',
  ]) {
    assert.deepEqual(getGovernmentIdErrorPresentation({ code }), temporary);
  }

  assert.deepEqual(
    getGovernmentIdErrorPresentation({
      statusCode: 409,
      code: 'GOVERNMENT_ID_VERIFICATION_IN_PROGRESS',
    }),
    {
      kind: 'IN_PROGRESS',
      title: 'Verification Already in Progress',
      message:
        'Your Government ID is already being checked. Please wait for the current attempt to finish.',
      action: 'none',
    }
  );

  assert.deepEqual(getGovernmentIdErrorPresentation({ statusCode: 429 }), {
    kind: 'RATE_LIMIT',
    title: 'Too Many Verification Attempts',
    message:
      "You've reached the Government ID verification attempt limit. Please wait a few minutes before trying again.",
    action: 'dismiss',
  });

  assert.deepEqual(
    getGovernmentIdErrorPresentation({
      statusCode: 500,
      message: 'sensitive provider detail',
    }),
    {
      kind: 'UNKNOWN',
      title: 'Unable to Verify ID',
      message: 'Something went wrong while verifying your ID. Please try again.',
      action: 'retry',
    }
  );
});

test('retryable failures preserve the same selected pair', () => {
  const front = { name: 'front.jpg' };
  const back = { name: 'back.jpg' };
  const pair = { front, back };
  const failures = [
    new TypeError('offline'),
    { kind: 'TIMEOUT' },
    { statusCode: 503 },
    { statusCode: 429 },
    { code: 'GOVERNMENT_ID_VERIFICATION_IN_PROGRESS' },
    { statusCode: 500, code: 'UNRECOGNIZED' },
  ];

  for (const failure of failures) {
    const presentation = getGovernmentIdErrorPresentation(failure);
    assert.notEqual(presentation.action, 'retake');
    assert.strictEqual(pair.front, front);
    assert.strictEqual(pair.back, back);
  }
});

test('client file validation matches JPEG/PNG, non-empty, 10MB-per-side contract', () => {
  const tenMb = 10 * 1024 * 1024;
  assert.equal(
    validateGovernmentIdFile({ type: 'image/jpeg', size: 1 }, 'Front'),
    null
  );
  assert.equal(
    validateGovernmentIdFile({ type: 'image/png', size: tenMb }, 'Back'),
    null
  );
  assert.equal(
    validateGovernmentIdFile({ type: 'image/jpeg', size: 0 }, 'Front'),
    'Front ID image cannot be empty.'
  );
  assert.equal(
    validateGovernmentIdFile({ type: 'image/webp', size: 1 }, 'Front'),
    'Invalid file type. Only JPEG and PNG images are accepted.'
  );
  assert.equal(
    validateGovernmentIdFile({ type: 'image/png', size: tenMb + 1 }, 'Back'),
    'Back ID image must be 10MB or smaller.'
  );
});

test('attempt tracker enforces single flight and explicit same-pair retry', () => {
  const tracker = new GovernmentIdAttemptTracker();
  const pair = { front: {}, back: {} };

  const attemptA = tracker.start();
  assert.equal(attemptA, 1);
  assert.equal(tracker.start(), null, 'rapid second submit must be ignored');
  tracker.finish(attemptA);

  const retryAttempt = tracker.start();
  assert.equal(retryAttempt, 2);
  assert.strictEqual(pair.front, pair.front);
  assert.strictEqual(pair.back, pair.back);
});

test('file replacement invalidates Attempt A before Attempt B can commit', () => {
  const tracker = new GovernmentIdAttemptTracker();
  const attemptA = tracker.start();
  tracker.invalidate();
  const attemptB = tracker.start();

  assert.equal(tracker.isCurrent(attemptA), false);
  assert.equal(tracker.isCurrent(attemptB), true);
});

test('unmount invalidates an in-flight response and prevents later starts', () => {
  const tracker = new GovernmentIdAttemptTracker();
  const attempt = tracker.start();
  tracker.unmount();

  assert.equal(tracker.isCurrent(attempt), false);
  assert.equal(tracker.start(), null);
});

test('component wiring provides timeout, abort, stale-response, cleanup, and active-control safety', () => {
  assert.match(sectionContent, /GOVERNMENT_ID_TIMEOUT_MS = 60_000/);
  assert.match(sectionContent, /new AbortController\(\)/);
  assert.match(sectionContent, /controller\.abort\(\)/);
  assert.match(
    sectionContent,
    /attemptTrackerRef\.current\.isCurrent\(attemptId\)/
  );
  assert.match(sectionContent, /activeRequestRef\.current/);
  assert.match(sectionContent, /URL\.revokeObjectURL/);
  assert.match(sectionContent, /disabled=\{submitting\}/);
  assert.match(
    sectionContent,
    /onClick=\{\(\) => void submitCurrentPair\(\)\}/
  );
  assert.equal(
    (sectionContent.match(/useEffect\(/g) || []).length,
    1,
    'The only effect is lifecycle cleanup; selecting files must not auto-submit'
  );
  assert.doesNotMatch(
    sectionContent,
    /useEffect\(\(\) => \{\s*void submitCurrentPair/,
    'Selecting two files must not auto-submit'
  );
});

test('Government ID action cannot submit the enclosing profile form', () => {
  assert.match(profilePageContent, /<form onSubmit=\{handleSave\}/);
  assert.match(profilePageContent, /<GovernmentIdSection \/>/);
  assert.doesNotMatch(
    sectionContent,
    /<form\b|onSubmit=\{/,
    'GovernmentIdSection must not create a nested submit boundary'
  );
  assert.match(
    sectionContent,
    /type="button"[\s\S]{0,220}onClick=\{\(\) => void submitCurrentPair\(\)\}/,
    'Government ID verification must use an explicit non-submit button action'
  );
});

test('success and rejection are committed before best-effort profile refresh', () => {
  const resultCommitIndex = sectionContent.indexOf('setLocalResult(response)');
  const verifiedIndex = sectionContent.indexOf("response.status === 'VERIFIED'");
  const rejectionIndex = sectionContent.indexOf("response.status === 'REJECTED'");
  const refreshIndex = sectionContent.indexOf('refreshProfileBestEffort()');

  assert.ok(resultCommitIndex !== -1);
  assert.ok(verifiedIndex > resultCommitIndex);
  assert.ok(rejectionIndex > verifiedIndex);
  assert.ok(refreshIndex > verifiedIndex);
  assert.match(sectionContent, /void refreshProfile\(\)\.catch\(\(\) => undefined\)/);
  assert.match(
    sectionContent,
    /getGovernmentIdRejectionPresentation\([\s\S]*response\.sideIssue/
  );
  assert.doesNotMatch(sectionContent, /setFailurePresentation\([^)]*err\.message/);
});

test('API and response types consume the existing backend contract without global client changes', () => {
  assert.match(apiContent, /GovernmentIdRejectionReason/);
  assert.match(apiContent, /GovernmentIdSideIssue/);
  assert.match(apiContent, /GovernmentIdFailedSide/);
  assert.match(apiContent, /options\?: \{ signal\?: AbortSignal \}/);
  assert.match(apiContent, /\{ signal: options\?\.signal \}/);
  assert.match(apiContent, /\/identity-verification\/submit/);
});

test('request and scheduling gates retain profile-first precedence and valid_id behavior', () => {
  const requestProfileIndex = requestWizardContent.indexOf(
    'if (isProfileIncomplete)'
  );
  const requestIdIndex = requestWizardContent.indexOf(
    'if (!isGovIdVerified)'
  );
  const scheduleProfileIndex = schedulerContent.indexOf(
    'if (isProfileIncomplete)'
  );
  const scheduleIdIndex = schedulerContent.indexOf('if (!isGovIdVerified)');

  assert.ok(requestProfileIndex !== -1 && requestProfileIndex < requestIdIndex);
  assert.ok(
    scheduleProfileIndex !== -1 && scheduleProfileIndex < scheduleIdIndex
  );
  assert.match(
    requestWizardContent,
    /req\.id === 'valid_id' && isGovIdVerified/
  );
  assert.match(
    requestWizardContent,
    /Verified through your TESTIMONIUM profile/
  );
  assert.match(requestWizardContent, /navigate\('\/dashboard\/profile'\)/);
  assert.match(schedulerContent, /navigate\('\/dashboard\/profile'\)/);
});

test('upload form renders informational photo notice directly below upload boxes', () => {
  const frontBoxIndex = sectionContent.indexOf('Front of ID');
  const backBoxIndex = sectionContent.indexOf('Back of ID');
  const noticeIndex = sectionContent.indexOf(
    'Make sure the entire ID is clearly visible, readable, well-lit, and not blurry. Avoid glare, shadows, and cropped edges.'
  );
  const secondaryIndex = sectionContent.indexOf('JPEG or PNG • Maximum 10 MB');
  const submitButtonIndex = sectionContent.indexOf('Submit ID for Verification');

  assert.ok(frontBoxIndex !== -1, 'Front ID box must exist');
  assert.ok(backBoxIndex !== -1, 'Back ID box must exist');
  assert.ok(noticeIndex !== -1, 'Informational notice must exist');
  assert.ok(secondaryIndex !== -1, 'Secondary line must exist');
  assert.ok(
    noticeIndex > frontBoxIndex && noticeIndex > backBoxIndex,
    'Informational notice must be placed after Front and Back ID upload boxes'
  );
  assert.ok(
    noticeIndex < submitButtonIndex,
    'Informational notice must be placed before submit button'
  );
});

test('scanning animation mounts during active submission without fake progress or artificial delay', () => {
  assert.match(sectionContent, /submitting && \(/);
  assert.match(sectionContent, /<GovernmentIdVerifyingAnimation \/>/);
  assert.match(sectionContent, /role="status"/);
  assert.match(sectionContent, /aria-live="polite"/);

  const animationContent = fs.readFileSync(
    path.join(srcDir, 'components/profile/GovernmentIdVerifyingAnimation.tsx'),
    'utf8'
  );

  assert.match(animationContent, /Verifying your Government ID/);
  assert.match(animationContent, /Please wait while TESTIMONIUM checks the submitted ID/);
  assert.match(animationContent, /gov-id-scan-line/);
  assert.match(animationContent, /gov-id-frame-pulse/);
  assert.match(animationContent, /prefers-reduced-motion/);
  assert.match(animationContent, /border-emerald-600/);

  // Strictly no fake progress indicators or simulated stages in rendered output
  assert.doesNotMatch(animationContent, />\s*(25%|50%|75%|100%)\s*</);
  assert.doesNotMatch(animationContent, /Checking image\.\.\.|Reading name\.\.\.|Checking expiry\.\.\./);
  assert.doesNotMatch(animationContent, /progress-bar|role="progressbar"/i);
});
