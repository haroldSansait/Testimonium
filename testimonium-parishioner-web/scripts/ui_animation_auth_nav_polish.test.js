import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve('c:/Users/me/Documents/testimonium/testimonium-parishioner-web');

test('Landing Page animation implementation contract', () => {
  const landingPageContent = fs.readFileSync(path.join(projectRoot, 'src/pages/public/LandingPage.tsx'), 'utf-8');
  
  // Hero initial entrance animation
  assert.ok(landingPageContent.includes('heroEntered'), 'LandingPage must define heroEntered state');
  assert.ok(landingPageContent.includes('requestAnimationFrame'), 'Hero entrance must use requestAnimationFrame for initial paint transition');
  assert.ok(landingPageContent.includes('Roman Catholic Diocese of San Carlos'), 'Hero must contain Diocese name');
  assert.ok(landingPageContent.includes('Connect with Your Parish Community'), 'Hero must contain main heading');
  assert.ok(landingPageContent.includes('motion-reduce:transition-none'), 'Hero must respect prefers-reduced-motion');
  assert.ok(landingPageContent.includes('delay-100') && landingPageContent.includes('delay-200') && landingPageContent.includes('delay-300'), 'Hero elements must have subtle stagger');

  // Scroll reveal hook integration for replaying animations
  assert.ok(landingPageContent.includes('useScrollReveal'), 'LandingPage must import useScrollReveal');
  assert.ok(landingPageContent.includes('bannerRef') && landingPageContent.includes('isBannerVisible'), 'Banner section must use scroll reveal');
  assert.ok(landingPageContent.includes('servicesRef') && landingPageContent.includes('isServicesVisible'), 'Services section must use scroll reveal');
  assert.ok(landingPageContent.includes('aboutRef') && landingPageContent.includes('isAboutVisible'), 'About section must use scroll reveal');
  assert.ok(landingPageContent.includes('staffRef') && landingPageContent.includes('isStaffVisible'), 'Staff section must use scroll reveal');

  // Stagger between service cards
  assert.ok(landingPageContent.includes('index * 90'), 'Service cards must have staggered transition delays');
});

test('useScrollReveal hook supports replaying and reduced motion', () => {
  const hookContent = fs.readFileSync(path.join(projectRoot, 'src/hooks/useScrollReveal.ts'), 'utf-8');

  assert.ok(hookContent.includes('IntersectionObserver'), 'useScrollReveal must use IntersectionObserver');
  assert.ok(hookContent.includes('setIsVisible(entry.isIntersecting)'), 'Visibility must toggle with entry.isIntersecting to support replaying on reverse scroll');
  assert.ok(hookContent.includes('prefers-reduced-motion'), 'useScrollReveal must check prefers-reduced-motion');
});

test('PublicLayout route recognition preserves Back to Landing Page across all auth routes', () => {
  const publicLayoutContent = fs.readFileSync(path.join(projectRoot, 'src/layouts/PublicLayout.tsx'), 'utf-8');

  // Verify route recognition
  assert.ok(publicLayoutContent.includes("isForgotPasswordPage = location.pathname === '/forgot-password'"), 'Must recognize /forgot-password');
  assert.ok(publicLayoutContent.includes("isVerifyEmailPage = location.pathname === '/verify-email'"), 'Must recognize /verify-email');
  assert.ok(publicLayoutContent.includes('isLoginPage || isSignupPage || isForgotPasswordPage || isVerifyEmailPage'), 'isAuthPage must include all 4 auth routes');

  // Verify Back to Landing Page button
  assert.ok(publicLayoutContent.includes('Back to Landing Page'), 'Must render Back to Landing Page button');
  assert.ok(publicLayoutContent.includes('to="/"'), 'Back button must navigate to /');
  assert.ok(publicLayoutContent.includes('ArrowLeft'), 'Back button must have ArrowLeft icon');
});

test('Modal and EventDetailsModal support coordinated smooth animation and event retention', () => {
  const modalContent = fs.readFileSync(path.join(projectRoot, 'src/components/ui/Modal.tsx'), 'utf-8');
  const eventDetailsModalContent = fs.readFileSync(path.join(projectRoot, 'src/features/events/components/EventDetailsModal.tsx'), 'utf-8');

  // Modal component contract
  assert.ok(modalContent.includes('animated?: boolean'), 'ModalProps must define optional animated prop');
  assert.ok(modalContent.includes('isAnimated ? !isRendered : !isOpen'), 'Modal must keep rendered during exit transition when animated');
  assert.ok(modalContent.includes('pointerEvents'), 'Modal container must disable pointer events when unmounting');
  assert.ok(modalContent.includes('prefers-reduced-motion'), 'Modal must respect reduced motion');
  assert.ok(modalContent.includes('transitionDuration: isAnimatingIn ? \'250ms\' : \'200ms\''), 'Backdrop must have coordinated opening and closing duration');

  // EventDetailsModal contract
  assert.ok(eventDetailsModalContent.includes('animated'), 'EventDetailsModal must pass animated to Modal');
  assert.ok(eventDetailsModalContent.includes('lastEventRef'), 'EventDetailsModal must preserve last valid event reference during exit unmount');
});

test('ParishDirectoryPage fullscreen morph animation implementation contract', () => {
  const directoryContent = fs.readFileSync(path.join(projectRoot, 'src/pages/dashboard/ParishDirectoryPage.tsx'), 'utf-8');

  // Morph animation state and refs
  assert.ok(directoryContent.includes('placeholderRef'), 'Must define placeholderRef for FLIP layout slot');
  assert.ok(directoryContent.includes('mapContainerRef'), 'Must define mapContainerRef for animated container');
  assert.ok(directoryContent.includes('morphPhase') || directoryContent.includes('MorphPhase'), 'Must track morphPhase for expand/contract lifecycle');
  assert.ok(directoryContent.includes('morphStyle'), 'Must manage morphStyle for coordinate interpolation');
  assert.ok(directoryContent.includes('isAnimatingRef'), 'Must guard against rapid repeated clicks with isAnimatingRef');

  // FLIP measurements and transitions
  assert.ok(directoryContent.includes('getBoundingClientRect()'), 'Must measure bounding rects for FLIP transition');
  assert.ok(directoryContent.includes('400ms cubic-bezier'), 'Must use smooth 400ms transition curve');
  assert.ok(directoryContent.includes('border-radius'), 'Must transition border-radius between embedded and fullscreen');
  assert.ok(directoryContent.includes('prefers-reduced-motion'), 'Must respect prefers-reduced-motion');
  assert.ok(directoryContent.includes('window.dispatchEvent(new Event(\'resize\'))'), 'Must dispatch resize to ensure Leaflet invalidates and re-renders tiles');

  // Keyboard accessibility
  assert.ok(directoryContent.includes('Escape') && directoryContent.includes('handleToggleFullScreen'), 'Must exit fullscreen on Escape key');

  // Controls preservation
  assert.ok(directoryContent.includes('handleLocateMe'), 'Must preserve Locate Me functionality');
  assert.ok(directoryContent.includes('handleResetView'), 'Must preserve Reset View functionality');
  assert.ok(directoryContent.includes('ParishMarker'), 'Must preserve ParishMarker rendering');
  assert.ok(directoryContent.includes('ParishDrawer'), 'Must preserve ParishDrawer overlay');
});

