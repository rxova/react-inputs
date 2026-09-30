import { useEffect } from "react";

/**
 * The WebOTP shape isn't in the DOM lib types yet, so declare the sliver we
 * touch. `OTPCredential` extends `Credential` with the delivered `code`.
 */
interface OTPCredential extends Credential {
  readonly code: string;
}
interface OTPCredentialRequestOptions extends CredentialRequestOptions {
  otp: { transport: string[] };
}

export interface UseWebOTPOptions {
  /** When false (the default path for an unset prop), the hook is inert. */
  enabled?: boolean;
  /** Called with the received code, already the raw digits from the SMS. */
  onReceive: (code: string) => void;
  /** Optional external signal; the request also aborts on unmount. */
  signal?: AbortSignal;
}

interface OTPCredentialsContainer {
  get(options: OTPCredentialRequestOptions): Promise<OTPCredential | null>;
}

/**
 * The WebOTP getter if — and only if — this platform supports it (Android
 * Chrome), else `null`. Extracted from the effect so the feature gate is a pure,
 * unit-testable function rather than an untestable branch inside `useEffect`.
 * @internal Not part of the public API (see index.ts).
 */
export function getOTPCredentials(): OTPCredentialsContainer | null {
  /* v8 ignore next -- SSR guard; the getter is only called from a client effect */
  if (typeof window === "undefined" || !("OTPCredential" in window)) return null;
  const credentials = navigator.credentials as
    (CredentialsContainer & OTPCredentialsContainer) | undefined;
  /* v8 ignore next -- credentials.get is always present alongside OTPCredential */
  if (!credentials || typeof credentials.get !== "function") return null;
  return credentials;
}

/**
 * Subscribe to the WebOTP API (`navigator.credentials.get({ otp })`) — the SMS
 * retrieval primitive **no other OTP library ships**. Progressive enhancement,
 * layered on top of `autocomplete="one-time-code"`, never instead of it: where
 * the API is absent (everything but Android Chrome) this is a clean no-op.
 *
 * Aborts the pending request on unmount *and* when `enabled` flips off, which
 * fixes the leaked-request / dangling-timer class of bug: a `credentials.get`
 * left in flight past unmount can resolve into a setState on a gone component.
 */
export function useWebOTP({ enabled, onReceive, signal }: UseWebOTPOptions): void {
  useEffect(() => {
    if (!enabled) return;
    const credentials = getOTPCredentials();
    if (!credentials) return;

    const controller = new AbortController();
    // Fold an external abort into ours so a caller can cancel too.
    const onExternalAbort = () => {
      controller.abort();
    };
    if (signal) {
      if (signal.aborted) return;
      signal.addEventListener("abort", onExternalAbort);
    }

    credentials
      .get({ otp: { transport: ["sms"] }, signal: controller.signal })
      .then((credential) => {
        if (credential?.code) onReceive(credential.code);
      })
      .catch(() => {
        // AbortError on unmount, or the user dismissing the SMS prompt. Neither
        // is exceptional for progressive enhancement — swallow and stay quiet.
      });

    return () => {
      controller.abort();
      if (signal) signal.removeEventListener("abort", onExternalAbort);
    };
  }, [enabled, onReceive, signal]);
}
