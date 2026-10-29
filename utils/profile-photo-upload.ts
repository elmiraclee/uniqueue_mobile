import { Platform } from 'react-native';
import { router } from 'expo-router';
import { API } from '@/constants/backend';
import { getSessionToken } from '@/utils/session-storage';
import { clearClientSession } from '@/utils/client-fetch';

export type PickedProfilePhoto = {
  uri: string;
  mimeType?: string | null;
  fileSize?: number;
  file?: Blob;
};
export type ProfilePhotoUploadResult = {
  success: true;
  picture: string;
  picture_url?: string;
  message?: string;
};
export class ProfilePhotoUploadError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 0) {
    super(message);
    this.name = 'ProfilePhotoUploadError';
    this.code = code;
    this.status = status;
  }
}

/** Native local-file multipart transport. No Content-Type override and no automatic write retry. */
export async function uploadProfilePhoto(asset: PickedProfilePhoto): Promise<ProfilePhotoUploadResult> {
  let token: string | null;
  try { token = await getSessionToken(); }
  catch { throw new ProfilePhotoUploadError('PHOTO_SESSION_UNAVAILABLE', 'The saved session could not be read. Sign in again before uploading.'); }
  if (!token) throw new ProfilePhotoUploadError('PHOTO_AUTH_REQUIRED', 'Sign in again before uploading a photo.', 401);
  if (!asset || typeof asset.uri !== 'string' || !asset.uri.trim()) {
    throw new ProfilePhotoUploadError('PHOTO_FILE_MISSING', 'Choose the photo again. No readable photo URI was returned.');
  }
  if (asset.fileSize && asset.fileSize > 3 * 1024 * 1024) {
    throw new ProfilePhotoUploadError('PHOTO_TOO_LARGE', 'Choose a photo at most 3 MB.', 413);
  }
  const suppliedMime = asset.mimeType?.toLowerCase();
  const mime = suppliedMime === 'image/jpg' ? 'image/jpeg' : suppliedMime || 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    throw new ProfilePhotoUploadError('PHOTO_FORMAT_UNSUPPORTED', 'Choose a JPG, PNG or WebP image. Convert HEIC photos to JPG first.', 422);
  }
  const name = 'profile.' + (mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg');
  const body = new FormData();
  if (Platform.OS === 'web') {
    let file = asset.file;
    if (!file) {
      try {
        const result = await fetch(asset.uri);
        if (!result.ok) throw new Error('Photo read failed.');
        file = await result.blob();
      } catch {
        throw new ProfilePhotoUploadError('PHOTO_FILE_READ_FAILED', 'The selected photo could not be read. Choose it again.');
      }
    }
    if (file.size > 3 * 1024 * 1024) throw new ProfilePhotoUploadError('PHOTO_TOO_LARGE', 'Choose a photo at most 3 MB.', 413);
    body.append('picture', file, name);
  } else {
    let uri = asset.uri.trim();
    if (uri.startsWith('/')) uri = 'file://' + uri;
    const readable = /^file:\/\/.+/i.test(uri) || (Platform.OS === 'android' && /^content:\/\/.+/i.test(uri));
    if (!readable) throw new ProfilePhotoUploadError('PHOTO_URI_UNSUPPORTED', 'The gallery returned a photo reference the app cannot upload. Choose the photo again from this device.');
    body.append('picture', { uri, type: mime, name } as any);
  }

  return new Promise<ProfilePhotoUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', API.uploadProfilePicture, true);
    xhr.timeout = 60000;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    // Do not set Content-Type: native/browser XHR must generate the multipart boundary.
    xhr.onload = () => {
      void (async () => {
        if (xhr.status === 401) {
          // Do not clear a new session if an older in-flight upload returns 401.
          if (await getSessionToken() === token) {
            await clearClientSession();
            router.replace('/login');
          }
          throw new ProfilePhotoUploadError('PHOTO_AUTH_REQUIRED', 'Your session expired. Sign in again before uploading.', 401);
        }
        let data: any;
        try { data = JSON.parse(xhr.responseText); }
        catch { throw new ProfilePhotoUploadError('PHOTO_INVALID_RESPONSE', 'The upload endpoint returned a non-JSON response (HTTP ' + xhr.status + '). Check the upload endpoint/server logs.', xhr.status); }
        if (xhr.status < 200 || xhr.status >= 300 || !data?.success) {
          throw new ProfilePhotoUploadError(typeof data?.code === 'string' ? data.code : 'PHOTO_SERVER_REJECTED', data?.message || 'Photo upload was rejected (HTTP ' + xhr.status + ').', xhr.status);
        }
        if (typeof data.picture !== 'string' || !data.picture.startsWith('uploads/profile/')) {
          throw new ProfilePhotoUploadError('PHOTO_INVALID_RESPONSE', 'The server did not return a valid saved-photo path.', xhr.status);
        }
        resolve(data as ProfilePhotoUploadResult);
      })().catch(reject);
    };
    xhr.onerror = () => reject(new ProfilePhotoUploadError('PHOTO_NETWORK_ERROR', 'The photo upload failed before a usable HTTP response. Reselect a small JPG/PNG from this device and retry. If it repeats, report PHOTO_NETWORK_ERROR.'));
    xhr.ontimeout = () => reject(new ProfilePhotoUploadError('PHOTO_UPLOAD_TIMEOUT', 'The photo upload exceeded 60 seconds. Refresh your profile to check whether it saved before retrying.'));
    xhr.onabort = () => reject(new ProfilePhotoUploadError('PHOTO_UPLOAD_ABORTED', 'The photo upload was cancelled.'));
    try { xhr.send(body); }
    catch { reject(new ProfilePhotoUploadError('PHOTO_MULTIPART_SEND_FAILED', 'The app could not send the selected photo. Reselect it from this device and retry.')); }
  });
}
