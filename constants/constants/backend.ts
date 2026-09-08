// ============================================================
// BACKEND CONFIGURATION
// ============================================================
// LOCAL DEVELOPMENT:
//   Set IP_ADDRESS to your computer's LAN IP (find it with
//   `ipconfig` on Windows or `ifconfig`/`ip a` on Mac/Linux),
//   and make sure USE_PRODUCTION is false.
//
// PRODUCTION (Hostinger):
//   Set PRODUCTION_URL to your live domain's API folder and
//   set USE_PRODUCTION to true before building the APK.
// ============================================================

const USE_PRODUCTION = true;

const IP_ADDRESS = "10.175.114.120"; // only used when USE_PRODUCTION is false
const LOCAL_URL = `http://${IP_ADDRESS}/uniqueue_api`;

const PRODUCTION_URL = "https://uni-queue.site/uniqueue_api"; // <-- update this to your real domain

export const API_URL = USE_PRODUCTION ? PRODUCTION_URL : LOCAL_URL;

// Some screens build endpoint URLs directly instead of going through
// the API object below; they import API_BASE for that.
export const API_BASE = API_URL;

// ============================================================
// SITE ROOT (for files, not API endpoints)
// ============================================================
// The web app and this API live on the same server, but the web app's
// document root is one level ABOVE the "uniqueue_api" folder (e.g. the
// web app serves /student/..., /uploads/profile/..., etc. from the site
// root, while this API answers at /uniqueue_api/...). Uploaded profile
// pictures are saved under <site-root>/uploads/profile/ so the web app
// can see them too, so image URLs must be built against the site root,
// NOT against API_URL — using API_URL here previously pointed at
// /uniqueue_api/uploads/profile/..., a folder the web app never reads
// from, which is why a picture uploaded on mobile didn't show up on web.
const API_FOLDER_NAME = "uniqueue_api";
export const SITE_URL = API_URL.replace(
  new RegExp(`/${API_FOLDER_NAME}/?$`),
  ""
);

// Use this (not API_URL) whenever building a URL for an uploaded file
// (e.g. `${ASSET_BASE_URL}/${picture}`).
export const ASSET_BASE_URL = SITE_URL;

export const API = {
  // LOGIN.TSX
  login: `${API_URL}/login.php`,

  // SIGNUP.TSX
  signup: `${API_URL}/signup.php`,
  getColleges: `${API_URL}/get_colleges.php`,
  getPrograms: `${API_URL}/get_programs.php`,

  // QUEUE / OFFICE-QUEUE
  getServiceItems: `${API_URL}/get_service_items.php`,
  getPayableTickets: `${API_URL}/get_payable_tickets.php`,

  // OFFICE-QUEUE.TSX
  getOffice: `${API_URL}/get_offices.php`,

  // STUDENT QUEUE
  getStudentTransactions: `${API_URL}/get_student_transaction.php`,

  // PROFILE.TSX
  getStudentProfile: `${API_URL}/get_student_profile.php`,
  uploadProfilePicture: `${API_URL}/upload_profile_picture.php`,
  updateProfile: `${API_URL}/update_profile.php`,
  changePassword: `${API_URL}/change_password.php`,

  // HOME
  getCurrentQueue: `${API_URL}/get_current_queue.php`,
  cancelQueue: `${API_URL}/cancel_queue.php`,
  getQueueDetails: `${API_URL}/get_queue_details.php`,
  requeueRespond: `${API_URL}/requeue_respond.php`,

  // LIVE QUEUE
  getLiveQueue: `${API_URL}/get_live_queue.php`,

  // FEEDBACK
  getPendingFeedback: `${API_URL}/get_pending_feedback.php`,
  submitFeedback: `${API_URL}/submit_feedback.php`,

  // NOTIFICATIONS
  // NOTE: filenames are singular ("notification", not "notifications")
  // to match the files in uniqueue_api/.
  checkNotifications: `${API_URL}/check_notification.php`,
  getNotifications: `${API_URL}/get_notification.php`,
  markNotificationsRead: `${API_URL}/mark_notification_read.php`,

  // GOOGLE AUTH
  googleAuth: `${API_URL}/google_auth.php`,
};

// ============================================================
// GOOGLE SIGN-IN (Expo AuthSession)
// ============================================================
// Create OAuth 2.0 Client IDs in Google Cloud Console:
//   - Web application  → GOOGLE_WEB_CLIENT_ID  (required; used for id_token)
//   - Android          → GOOGLE_ANDROID_CLIENT_ID (optional but recommended)
//   - iOS              → GOOGLE_IOS_CLIENT_ID (optional but recommended)
//
// Use the SAME Google Cloud project as the web app when possible.
// Authorized redirect URIs for Expo Go / dev:
//   https://auth.expo.io/@YOUR_EXPO_USERNAME/Uniqueue
//   uniqueue://
// For production builds, add the scheme from app.json ("uniqueue").
// ============================================================

export const GOOGLE_WEB_CLIENT_ID =
  "YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com";
export const GOOGLE_ANDROID_CLIENT_ID =
  "YOUR_GOOGLE_ANDROID_CLIENT_ID.apps.googleusercontent.com";
export const GOOGLE_IOS_CLIENT_ID =
  "YOUR_GOOGLE_IOS_CLIENT_ID.apps.googleusercontent.com";

// Add to API map
