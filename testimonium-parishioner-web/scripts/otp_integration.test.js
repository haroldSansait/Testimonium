import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromePath, otpBrowser } from './helpers/otp-browser.js';

describe('OTP pages, AuthContext, SessionService and route guard in Chrome with controlled Firebase/HTTP boundaries', { skip: !chromePath && 'Chrome unavailable', timeout: 240000 }, () => {
  let b;
  before(async()=>{b=await otpBrowser();});
  after(async()=>{await b?.close();});
  beforeEach(async()=>{
    await b.evaluate('sessionStorage.clear(); localStorage.clear()');
    await b.send('Page.navigate',{url:`${b.origin}/login`});
    await b.waitFor('window.fixture?.auth && !window.fixture.auth.loading && document.querySelector("input[type=email]")');
  });
  const fill=async (selector,value)=>b.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}); if(!e) throw new Error('Missing input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)}); e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const click=async text=>b.evaluate(`(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.textContent.includes(${JSON.stringify(text)}));if(!e)throw new Error('Missing button');e.click();})()`);
  const navigate=async path=>{await b.evaluate(`window.fixture.navigate(${JSON.stringify(path)})`);};
  const unverified=async()=>{await b.evaluate('window.fixture.session(false)');await navigate('/verify-email');await b.waitFor('document.querySelector("#email-verify-otp") && !document.querySelector("#email-verify-otp").disabled');};

  it('uses one selectable numeric input for full paste, leading zeros, editing, backspace and mobile width',async()=>{
    await navigate('/otp-input'); await b.waitFor('document.querySelector("#otp")');
    await b.send('Emulation.setDeviceMetricsOverride',{width:320,height:720,deviceScaleFactor:1,mobile:true});
    await b.evaluate('document.querySelector("#otp").focus()'); await b.send('Input.insertText',{text:'000042'});
    await b.waitFor('window.fixture.completions===1');
    assert.equal(await b.evaluate('document.querySelector("#otp").value'),'000042');
    await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});
    await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});
    await b.waitFor('document.querySelector("#otp").value.length===5');
    assert.equal(await b.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
    await b.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  });
  it('redirects a signed-out visitor away from verification',async()=>{
    await navigate('/verify-email'); await b.waitFor('location.pathname==="/login"');
  });
  it('routes unverified email login to OTP, confirms once and reloads Firebase/token/profile before dashboard',async()=>{
    await fill('input[type=email]','owner@example.invalid'); await fill('input[type=password]','FixturePassword123');
    await b.evaluate('document.querySelector("form").requestSubmit()');
    await b.waitFor('location.pathname==="/verify-email" && document.querySelector("#email-verify-otp") && !document.querySelector("#email-verify-otp").disabled');
    await fill('#email-verify-otp','000042'); await b.waitFor('location.pathname==="/dashboard/home"');
    assert.equal(await b.evaluate('window.fixture.calls.filter(c=>c.path.endsWith("/verification/confirm")).length'),1);
    assert.ok(await b.evaluate('window.fixture.reloads>=1 && window.fixture.freshTokens>=1 && window.fixture.auth.appProfile.emailVerified'));
  });
  it('keeps an incorrect or expired code editable and announces the error',async()=>{
    await unverified(); await fill('#email-verify-otp','999999');
    await b.waitFor('document.querySelector("[aria-live]").textContent.includes("Invalid or expired")');
    assert.equal(await b.evaluate('document.querySelector("#email-verify-otp").disabled'),false);
    assert.equal(await b.evaluate('location.pathname'),'/verify-email');
  });
  it('refreshes a pending verification page and restores resend feedback',async()=>{
    await unverified(); await b.send('Page.reload');
    await b.waitFor('document.querySelector("#email-verify-otp") && document.body.innerText.includes("Resend in")');
    assert.equal(await b.evaluate('window.fixture.auth.user.uid'),'fixture-owner');
  });
  it('rejects stale completion navigation after switching accounts',async()=>{
    await unverified(); await b.evaluate('window.fixture.holdConfirm=true'); await fill('#email-verify-otp','000042');
    await b.waitFor('typeof window.fixture.release==="function"');
    await b.evaluate('window.fixture.session(false,"different-owner","different@example.invalid")');
    await b.evaluate('window.fixture.release()');
    await b.waitFor('window.fixture.auth.user.uid==="different-owner" && document.querySelector("#email-verify-otp")');
    assert.equal(await b.evaluate('location.pathname'),'/verify-email');
  });
  it('routes already verified accounts past OTP without sending mail',async()=>{
    await b.evaluate('window.fixture.session(true)'); await navigate('/verify-email'); await b.waitFor('location.pathname==="/dashboard/home"');
    assert.equal(await b.evaluate('window.fixture.calls.some(c=>c.path.includes("/otp/verification"))'),false);
  });
  it('preserves trusted Google login without OTP',async()=>{
    await b.evaluate('window.fixture.auth.signInWithGoogle()'); await navigate('/dashboard/home');
    await b.waitFor('document.body.innerText.includes("Authenticated dashboard fixture")');
    assert.equal(await b.evaluate('window.fixture.calls.some(c=>c.path.includes("/otp/verification"))'),false);
  });
  it('registers backend/legal identity before initial OTP and completes verification',async()=>{
    await b.evaluate('window.fixture.auth.signUpWithEmail("new@example.invalid","FixturePassword123",{firstName:"Fixture",lastName:"Owner"},{termsAccepted:true,privacyAccepted:true,termsVersion:"1.0",privacyVersion:"1.0"})');
    await navigate('/verify-email'); await b.waitFor('document.querySelector("#email-verify-otp") && !document.querySelector("#email-verify-otp").disabled');
    assert.equal(await b.evaluate('window.fixture.calls.findIndex(c=>c.path.endsWith("/register")) < window.fixture.calls.findIndex(c=>c.path.endsWith("/verification/request"))'),true);
    await fill('#email-verify-otp','000042'); await b.waitFor('location.pathname==="/dashboard/home"');
  });
  it('reauthenticates an email correction and requests a code for the refreshed address',async()=>{
    await unverified(); await click('Change Email'); await b.waitFor('document.querySelector("input[type=email]")');
    await fill('input[type=email]','corrected@example.invalid'); await fill('input[type=password]','FixturePassword123');
    await b.evaluate('document.querySelector("form").requestSubmit()');
    await b.waitFor('window.fixture.reauthenticated && window.fixture.auth.appProfile.email==="corrected@example.invalid"');
    await b.waitFor('document.body.innerText.includes("corrected@example.invalid")');
    assert.equal(await b.evaluate('window.fixture.auth.appProfile.emailVerified'),false);
  });
  it('completes public recovery from email through code/password to login and clears the grant',async()=>{
    await navigate('/forgot-password'); await b.waitFor('document.querySelector("input[type=email]")');
    await fill('input[type=email]','owner@example.invalid'); await b.evaluate('document.querySelector("form").requestSubmit()');
    await b.waitFor('document.querySelector("#pw-reset-otp")'); await fill('#pw-reset-otp','000042');
    await b.waitFor('document.querySelector("#reset-new-password")');
    await fill('#reset-new-password','NewFixturePassword123'); await fill('#reset-confirm-password','NewFixturePassword123');
    await b.evaluate('document.querySelector("form").requestSubmit()'); await b.waitFor('document.body.innerText.includes("Password Reset Successful")');
    assert.equal(await b.evaluate('window.fixture.calls.filter(c=>c.path.endsWith("/password-reset/complete")).length'),1);
    await click('Return to Login'); await b.waitFor('location.pathname==="/login"');
  });
  it('honors server cooldown/daily errors and resumes countdown from wall time after background suspension',async()=>{
    await b.evaluate('window.fixture.verificationError={message:"Daily code limit reached",retryAfter:45}');
    await unverified(); await b.waitFor('document.body.innerText.includes("Daily code limit reached")');
    assert.equal(await b.evaluate('[...document.querySelectorAll("button")].find(e=>e.textContent.includes("Resend in")).disabled'),true);
    await b.evaluate('const originalNow=Date.now; Date.now=()=>originalNow()+61000');
    await b.waitFor('document.body.innerText.includes("Resend Code")');
  });
  it('preserves legal gating after successful OTP rather than bypassing onboarding',async()=>{
    await b.evaluate('window.fixture.legalAccepted=false'); await unverified(); await fill('#email-verify-otp','000042');
    await b.waitFor('location.pathname==="/dashboard/home" && document.body.innerText.includes("Terms of Service")');
    assert.equal(await b.evaluate('document.body.innerText.includes("Authenticated dashboard fixture")'),false);
  });
  it('offers a fresh reset challenge when the password grant has expired',async()=>{
    await navigate('/forgot-password'); await b.waitFor('document.querySelector("input[type=email]")');
    await fill('input[type=email]','owner@example.invalid'); await b.evaluate('document.querySelector("form").requestSubmit()');
    await b.waitFor('document.querySelector("#pw-reset-otp")'); await fill('#pw-reset-otp','000042');
    await b.waitFor('document.querySelector("#reset-new-password")'); await b.evaluate('window.fixture.resetExpired=true');
    await fill('#reset-new-password','NewFixturePassword123'); await fill('#reset-confirm-password','NewFixturePassword123');
    await b.evaluate('document.querySelector("form").requestSubmit()'); await b.waitFor('document.body.innerText.includes("Reset session expired")');
    await click('Request a fresh code'); await b.waitFor('document.querySelector("input[type=email]")');
    assert.equal(await b.evaluate('document.querySelector("#reset-new-password")'),null);
  });
  it('signs out of pending verification through the existing session service',async()=>{
    await unverified(); await click('Sign out and return to login'); await b.waitFor('location.pathname==="/login" && window.fixture.auth.user===null');
  });

  it('keeps verification after an older background profile request returns',async()=>{
    await unverified(); await b.evaluate('window.fixture.holdNextProfile=true; void window.fixture.auth.refreshProfile()');
    await b.waitFor('typeof window.fixture.releaseProfile==="function"'); await fill('#email-verify-otp','000042');
    await b.waitFor('location.pathname==="/dashboard/home"'); await b.evaluate('window.fixture.releaseProfile()');
    await b.waitFor('window.fixture.auth.appProfile.emailVerified');
    assert.equal(await b.evaluate('location.pathname'),'/dashboard/home');
  });

});
