import * as ImagePicker from "expo-image-picker";

/**
 * Choosing/taking the single meal photo for AI analysis, kept out of the
 * screen. Nothing here uploads anything - a selected photo only ever leaves
 * the device when the user taps Analyze (see api/mealAnalysisApi.ts).
 *
 * The image is used exactly as the picker returns it (quality 1, no
 * cropping/editing): no resizing or re-encoding is needed, the backend
 * enforces the same type/size limits checked here.
 */
export interface MealPhoto {
  uri: string;
  /** Multipart filename. */
  name: string;
  /** One of SUPPORTED_MIME_TYPES. */
  mimeType: string;
}

export type MealPhotoResult =
  | { kind: "selected"; photo: MealPhoto }
  | { kind: "cancelled" }
  | { kind: "permission_denied"; message: string; canOpenSettings: boolean }
  | { kind: "invalid"; message: string }
  | { kind: "error"; message: string };

// Same limits as the backend (apps/api/src/routes/mealAnalysisRoutes.ts)
// and Web's MealsPage - checked here only to fail fast, before an upload.
const SUPPORTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

const EXTENSION_MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
const MIME_EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export const UNSUPPORTED_PHOTO_MESSAGE = "Unsupported image format. Use JPEG, PNG, or WEBP.";
export const PHOTO_TOO_LARGE_MESSAGE = "Image is too large. Maximum size is 10 MB.";
const PICKER_ERROR_MESSAGE = "Could not open the photo picker. Please try again.";
const CAMERA_ERROR_MESSAGE = "Could not open the camera. Please try again.";

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  allowsEditing: false,
  allowsMultipleSelection: false,
  quality: 1,
};

function extensionOf(value: string | null | undefined): string | undefined {
  const match = value ? /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(value) : null;
  return match ? match[1].toLowerCase() : undefined;
}

/**
 * The picker usually reports mimeType; when it doesn't, fall back to the
 * file extension. Camera captures are always JPEG, so an unidentifiable
 * camera image is treated as one - an unidentifiable gallery image is
 * rejected rather than uploaded under a guessed type.
 */
export function resolveMealPhoto(asset: ImagePicker.ImagePickerAsset, source: "gallery" | "camera"): MealPhotoResult {
  const extension = extensionOf(asset.fileName) ?? extensionOf(asset.uri);
  const mimeType =
    asset.mimeType?.toLowerCase() ??
    (extension ? EXTENSION_MIME_TYPES[extension] : undefined) ??
    (source === "camera" ? "image/jpeg" : undefined);

  if (!mimeType || !SUPPORTED_MIME_TYPES.has(mimeType)) {
    return { kind: "invalid", message: UNSUPPORTED_PHOTO_MESSAGE };
  }
  if (asset.fileSize !== undefined && asset.fileSize > MAX_IMAGE_SIZE_BYTES) {
    return { kind: "invalid", message: PHOTO_TOO_LARGE_MESSAGE };
  }

  const name = asset.fileName?.trim() || `meal-photo.${MIME_EXTENSIONS[mimeType]}`;
  return { kind: "selected", photo: { uri: asset.uri, name, mimeType } };
}

function fromPickerResult(result: ImagePicker.ImagePickerResult, source: "gallery" | "camera"): MealPhotoResult {
  const asset = result.canceled ? undefined : result.assets[0];
  return asset ? resolveMealPhoto(asset, source) : { kind: "cancelled" };
}

function permissionDenied(
  permission: ImagePicker.PermissionResponse,
  what: "camera" | "photo library",
): MealPhotoResult {
  // canAskAgain === false: the OS will no longer show the prompt, so the
  // only way forward is the app's system settings page.
  return permission.canAskAgain
    ? { kind: "permission_denied", message: `Allow ${what} access to continue.`, canOpenSettings: false }
    : {
        kind: "permission_denied",
        message: `${what === "camera" ? "Camera" : "Photo library"} access is turned off. Enable it in Settings, then try again.`,
        canOpenSettings: true,
      };
}

/**
 * The system photo picker needs no permission on current Android/iOS, so
 * none is requested up front (no needless prompt). Only if opening it
 * fails is the photo-library permission requested, then the picker is
 * retried once.
 */
export async function pickMealPhotoFromGallery(): Promise<MealPhotoResult> {
  try {
    return fromPickerResult(await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS), "gallery");
  } catch {
    // Fall through to the permission path below.
  }

  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return permissionDenied(permission, "photo library");
    }
    return fromPickerResult(await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS), "gallery");
  } catch {
    return { kind: "error", message: PICKER_ERROR_MESSAGE };
  }
}

/** Camera capture through the system camera UI - no custom camera screen. Asks for camera permission every time it isn't granted yet, so a retry after granting just works. */
export async function takeMealPhoto(): Promise<MealPhotoResult> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return permissionDenied(permission, "camera");
    }
    return fromPickerResult(await ImagePicker.launchCameraAsync(PICKER_OPTIONS), "camera");
  } catch {
    return { kind: "error", message: CAMERA_ERROR_MESSAGE };
  }
}
