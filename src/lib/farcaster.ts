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
      composeCast?: (options?: {
        text?: string;
        embeds?: [] | [string] | [string, string];
        close?: boolean;
        channelKey?: string;
      }) => Promise<unknown>;
    };
  } | null;
};

export async function getFarcasterMiniAppState(): Promise<FarcasterMiniAppState> {
  if (typeof window === "undefined") {
    return { isMiniApp: false, context: null, sdk: null };
  }

  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    const context = await sdk.context as FarcasterMiniAppContext;
    return {
      isMiniApp: Boolean(context),
      context: context ?? null,
      sdk: sdk ?? null,
    };
  } catch {
    return { isMiniApp: false, context: null, sdk: null };
  }
}
