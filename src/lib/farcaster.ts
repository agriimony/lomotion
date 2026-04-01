export type FarcasterMiniAppContext = {
  user?: {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
  location?: {
    type: string;
    [key: string]: unknown;
  };
  client?: {
    platformType?: "web" | "mobile";
    clientFid?: number;
    added?: boolean;
    safeAreaInsets?: {
      top: number;
      bottom: number;
      left: number;
      right: number;
    };
  };
  features?: {
    haptics?: boolean;
    cameraAndMicrophoneAccess?: boolean;
  };
};

export type FarcasterMiniAppState = {
  isMiniApp: boolean;
  context: FarcasterMiniAppContext | null;
  sdk: {
    actions?: {
      ready: (options?: { disableNativeGestures?: boolean }) => Promise<void> | void;
    };
  } | null;
};

export async function getFarcasterMiniAppState(): Promise<FarcasterMiniAppState> {
  if (typeof window === "undefined") {
    return { isMiniApp: false, context: null, sdk: null };
  }

  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    const context = (sdk?.context ?? null) as FarcasterMiniAppContext | null;
    return {
      isMiniApp: Boolean(context),
      context,
      sdk: sdk ?? null,
    };
  } catch {
    return { isMiniApp: false, context: null, sdk: null };
  }
}
