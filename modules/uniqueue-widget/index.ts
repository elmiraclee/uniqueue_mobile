import { requireOptionalNativeModule } from "expo-modules-core";

/**
 * Android home-screen widget + realtime service bridge.
 *
 * Uses requireOptionalNativeModule so the app does NOT crash / spam
 * "Cannot find native module 'UniqueueWidget'" when the native code is not
 * compiled into the running binary (Expo Go, iOS, web, or a dev build made
 * before this module was added). In those cases this export is `null` and
 * every widget call becomes a no-op.
 */
export type UniqueueWidgetNativeModule = {
  update(data: Record<string, unknown>): Promise<boolean>;
  refresh(): Promise<boolean>;
  clear(): Promise<boolean>;
  vibrateAlarm(): Promise<boolean>;
};

const UniqueueWidget =
  requireOptionalNativeModule<UniqueueWidgetNativeModule>("UniqueueWidget");

export default UniqueueWidget;
