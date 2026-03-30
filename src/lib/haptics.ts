export function triggerHaptic(kind: "light" | "medium" | "success") {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (kind === "light") navigator.vibrate(8);
  else if (kind === "medium") navigator.vibrate(16);
  else navigator.vibrate([10, 24, 10]);
}
