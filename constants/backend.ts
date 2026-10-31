import deployment from '../deployment.generated.json';

// Generated together with the PHP profile by tools/select-deployment.py.
// No database, SMTP or other server secrets belong in this application.
export const DEPLOYMENT_PROFILE = deployment.profile;
export const API_URL = deployment.api_url.replace(/\/$/, '');
export const API_BASE = API_URL;
export const SITE_URL = deployment.web_url.replace(/\/$/, '');
export const ASSET_BASE_URL = SITE_URL;
export const LEGAL_URLS = {
  terms: `${SITE_URL}/legal/terms.php`,
  privacy: `${SITE_URL}/legal/privacy.php`,
};

export const API = {
  // LOGIN.TSX
  login: `${API_URL}/login.php`,

  // SIGNUP.TSX
  signup: `${API_URL}/signup.php`,
  getColleges: `${API_URL}/get_colleges.php`,
  getGradeOptions: `${API_URL}/get_grade_options.php`,
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
  getLiveTicketSnapshot: `${API_URL}/get_live_ticket_snapshot.php`,
  // Office-wide live monitor (port of web api/public-live-queue.php)
  publicLiveQueue: `${API_URL}/public_live_queue.php`,

  // FEEDBACK
  getPendingFeedback: `${API_URL}/get_pending_feedback.php`,
  submitFeedback: `${API_URL}/submit_feedback.php`,

  // NOTIFICATIONS
  // NOTE: filenames are singular ("notification", not "notifications")
  // to match the files in uniqueue_api/.
  checkNotifications: `${API_URL}/check_notification.php`,
  getNotifications: `${API_URL}/get_notification.php`,
  markNotificationsRead: `${API_URL}/mark_notification_read.php`,
  registerPushToken: `${API_URL}/register_push_token.php`,

  // GOOGLE AUTH
  googleAuth: `${API_URL}/google_auth.php`,

  // PARENT AUTH + DASHBOARD
  parentLogin: `${API_URL}/parent_login.php`,
  parentSignup: `${API_URL}/parent_signup.php`,
  getParentChildren: `${API_URL}/get_parent_children.php`,
  parentAddChild: `${API_URL}/parent_add_child.php`,
  getParentLinkRequests: `${API_URL}/get_parent_link_requests.php`,
  studentRespondLinkRequest: `${API_URL}/student_respond_link_request.php`,
  getParentNotifications: `${API_URL}/get_parent_notifications.php`,
  getParentProfile: `${API_URL}/get_parent_profile.php`,
  updateParentProfile: `${API_URL}/update_parent_profile.php`,

  // SERVICE NEED + EVENTS
  serviceNeedRequest: `${API_URL}/service_need_request.php`,
  getUnavailableServices: `${API_URL}/get_unavailable_services.php`,
  getOfficeEvents: `${API_URL}/get_office_events.php`,
  getEventSteps: `${API_URL}/get_event_steps.php`,
  getAcademicData: `${API_URL}/get_academic_data.php`,
  getParentPendingFeedback: `${API_URL}/get_parent_pending_feedback.php`,
  getParentTransactions: `${API_URL}/get_parent_transactions.php`,
  officeQueue: `${API_URL}/office-queue.php`,
  getTicketDetail: `${API_URL}/get_ticket_detail.php`,
  forgotPassword: `${API_URL}/forgot_password.php`,
  getStudentLinkedParents: `${API_URL}/get_student_linked_parents.php`,

  // WEB-PARITY ADDITIONS
  activateStudent: `${API_URL}/activate_student.php`,
  prequeueCheck: `${API_URL}/prequeue_check.php`,
  getPossibleWindows: `${API_URL}/get_possible_windows.php`,
  serviceNeedRequestMulti: `${API_URL}/service_need_request_multi.php`,
  queueProcess: `${API_URL}/queue_process.php`,
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
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "599687695657-rs4heefc9pm8cq63ic7mpclv0vm0pjna.apps.googleusercontent.com";
export const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "636391132357-gocgc0q2i7mbg3iibtopmgfbh83lpfk4.apps.googleusercontent.com";
export const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";

// Add to API map
