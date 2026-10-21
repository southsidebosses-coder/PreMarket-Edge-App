# Play Data-Safety Form — Exact Disclosure Wording

> ⚠ **OWNER CONFIRMATION REQUIRED before submitting.** The wording below reflects how the
> app is built today (AdMob banner + interstitial, AsyncStorage-only local data, no
> analytics SDK). Cross-check against **AdMob console → Privacy & messaging → Data
> disclosure** guidance and Google's "Disclose data collection — Mobile Ads SDK" page,
> then tick the box at the bottom. Nothing here should be submitted on AI say-so alone.

Form header answers (already determined by the build):
- **Encrypted in transit:** Yes — every network call is HTTPS (Yahoo chart API, Google ad endpoints).
- **Deletion mechanism:** Yes — uninstalling removes all on-device data (AsyncStorage journal/settings);
  provide your contact email for ad-data deletion requests. **[OWNER: fill email — same as privacy policy]**

## Row 1 — Device or other IDs (advertising ID)

| Form field | Exact selection |
|---|---|
| Does your app collect or share this data type? | **Collected: Yes · Shared: Yes** |
| Is this data ephemeral? | **No** |
| Is collecting/sharing this data required for the app to function? | **Optional** |
| Purpose | **Advertising** (add **Analytics** too only if you enable AdMob conversion measurement — [OWNER: confirm]) |

Wording rationale: Google Mobile Ads SDK reads the Android advertising ID and shares it
with Google/adx partners to serve and measure ads. The app never reads the ID itself.

## Row 2 — Approximate location

| Form field | Exact selection |
|---|---|
| Does your app collect or share this data type? | **Collected: Yes · Shared: Yes** |
| Is this data ephemeral? | **No** |
| Required for function? | **Optional** |
| Purpose | **Advertising** |

Wording rationale: AdMob derives **coarse (IP-signal-based) approximate location** to
pick relevant ads. The app requests **no location permissions** and never reads GPS.

## Row 3 — App interactions (already covered in DEPLOYMENT.md, repeated for completeness)

**Collected: Yes · Shared: Yes · Purpose: Analytics** (ad serving/measurement events only).

## NOT collected (leave unticked — safe to assert from the code)

Precise/coarse GPS, personal info (name/email/IDs), photos/videos/audio, contacts,
health, financial (no purchases are real — the $4.99 is simulated), messages, browsing
history, journal entries (on-device only, never transmitted).

## Owner sign-off

- [ ] Verified each row against AdMob disclosure guidance
- [ ] Contact email for deletion requests matches privacy policy
- [ ] Analytics purpose added/removed per AdMob measurement settings

Date/initials: ______
