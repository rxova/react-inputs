import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { getOTPCredentials, useWebOTP } from "../useWebOTP";
import type { UseWebOTPOptions } from "../useWebOTP";

function Harness(props: UseWebOTPOptions) {
  useWebOTP(props);
  return null;
}

type OtpGet = (options: { otp: { transport: string[] }; signal: AbortSignal }) => Promise<{
  code: string;
} | null>;

describe("useWebOTP", () => {
  let getSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    // The guard is `'OTPCredential' in window`; give it something to find.
    (window as unknown as { OTPCredential: unknown }).OTPCredential = function OTPCredential() {
      // marker only
    };
  });

  afterEach(() => {
    getSpy?.mockRestore();
    getSpy = undefined;
    delete (window as unknown as { OTPCredential?: unknown }).OTPCredential;
  });

  function stubGet(impl: OtpGet) {
    getSpy = vi.spyOn(navigator.credentials, "get").mockImplementation(impl as never);
    return getSpy;
  }

  it("getOTPCredentials detects support", () => {
    stubGet(() => Promise.resolve(null));
    expect(getOTPCredentials()).not.toBeNull();
    delete (window as unknown as { OTPCredential?: unknown }).OTPCredential;
    expect(getOTPCredentials()).toBeNull();
  });

  it("does nothing when disabled", () => {
    const get = stubGet(() => Promise.resolve(null));
    void render(<Harness enabled={false} onReceive={vi.fn()} />);
    expect(get).not.toHaveBeenCalled();
  });

  it("is inert when the platform lacks WebOTP", () => {
    delete (window as unknown as { OTPCredential?: unknown }).OTPCredential;
    const get = stubGet(() => Promise.resolve(null));
    void render(<Harness enabled onReceive={vi.fn()} />);
    expect(get).not.toHaveBeenCalled();
  });

  it("swallows a rejected request (dismissed prompt / abort)", async () => {
    const get = stubGet(() => Promise.reject(new Error("dismissed")));
    const onReceive = vi.fn();
    void render(<Harness enabled onReceive={onReceive} />);
    await vi.waitFor(() => {
      expect(get).toHaveBeenCalled();
    });
    expect(onReceive).not.toHaveBeenCalled();
  });

  it("ignores a resolution that carries no code", async () => {
    const get = stubGet(() => Promise.resolve(null));
    const onReceive = vi.fn();
    void render(<Harness enabled onReceive={onReceive} />);
    await vi.waitFor(() => {
      expect(get).toHaveBeenCalled();
    });
    expect(onReceive).not.toHaveBeenCalled();
  });

  it("aborts when an external signal fires after the request starts", async () => {
    const controller = new AbortController();
    let captured: AbortSignal | undefined;
    stubGet(
      (options) =>
        new Promise(() => {
          captured = options.signal;
        }),
    );
    void render(<Harness enabled onReceive={vi.fn()} signal={controller.signal} />);
    await vi.waitFor(() => {
      expect(captured).toBeDefined();
    });
    controller.abort();
    expect(captured?.aborted).toBe(true);
  });

  it("delivers a received code to onReceive", async () => {
    stubGet(() => Promise.resolve({ code: "123456" }));
    const onReceive = vi.fn();
    void render(<Harness enabled onReceive={onReceive} />);
    await vi.waitFor(() => {
      expect(onReceive).toHaveBeenCalledWith("123456");
    });
  });

  it("aborts the pending request on unmount", async () => {
    let captured: AbortSignal | undefined;
    stubGet(
      (options) =>
        new Promise(() => {
          captured = options.signal;
        }),
    );
    const { unmount } = await render(<Harness enabled onReceive={vi.fn()} />);
    await vi.waitFor(() => {
      expect(captured).toBeDefined();
    });
    void unmount();
    expect(captured?.aborted).toBe(true);
  });

  it("folds an external abort signal into the request", async () => {
    const controller = new AbortController();
    controller.abort();
    const get = stubGet(() => Promise.resolve(null));
    void render(<Harness enabled onReceive={vi.fn()} signal={controller.signal} />);
    // Already-aborted external signal short-circuits before calling get.
    expect(get).not.toHaveBeenCalled();
  });
});
