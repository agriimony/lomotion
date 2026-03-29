export function getCameraConstraints(facingMode: "user" | "environment") {
  return {
    audio: false,
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  } satisfies MediaStreamConstraints;
}
