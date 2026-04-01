export async function triggerHaptic(kind: "light" | "medium" | "success") {
  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    if (sdk?.haptics) {
      if (kind === "success") {
        await sdk.haptics.notificationOccurred("success");
        return;
      }
      await sdk.haptics.impactOccurred(kind === "light" ? "light" : "medium");
      return;
    }
  } catch {
    // fall back to navigator.vibrate
  }

  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (kind === "light") navigator.vibrate(8);
  else if (kind === "medium") navigator.vibrate(16);
  else navigator.vibrate([10, 24, 10]);
}
