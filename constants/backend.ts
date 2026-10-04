export const IP_ADDRESS = "192.168.68.1";

export const API_URL = `http://${IP_ADDRESS}/uniqueue_api`;

export const API = {
  // LOGIN.TSX
  login: `${API_URL}/login.php`,

  // SIGNUP.TSX
  signup: `${API_URL}/signup.php`,
  getStudents: `${API_URL}/get_students.php`,
  getColleges: `${API_URL}/get_colleges.php`,
  getPrograms: `${API_URL}/get_programs.php`,

  //QUEUE.TSX
  getWindows: `${API_URL}/get_windows.php`,
  getQueue: `${API_URL}/get_queue.php`,

  getServiceItems: `${API_URL}/get_service_items.php`,
  getStaff: `${API_URL}/get_staff.php`,

  //OFFICE-QUEUE.TSX
  getOffice: `${API_URL}/get_offices.php`,

  //QUEUE.TSX
  // STUDENT QUEUE
  getStudentTransactions: `${API_URL}/get_student_transaction.php`,

  //PROFILE.TSX
  getStudentProfile: `${API_URL}/get_student_profile.php`,
  uploadProfilePicture:`${API_URL}/upload_profile_picture.php`,
  //HOME
   getCurrentQueue: `${API_URL}/get_current_queue.php`,
   cancelQueue: `${API_URL}/cancel_queue.php`,
   getQueueDetails: `${API_URL}/get_queue_details.php`,

  //LIVE QUEUE
  getLiveQueue: `${API_URL}/get_live_queue.php`,
  getOfficeQueue: `${API_URL}/get_office_queue.php`,

  //FEEDBACK
  getPendingFeedback: `${API_URL}/get_pending_feedback.php`,
  submitFeedback: `${API_URL}/submit_feedback.php`,

  //NOTIFICATIONS
  // NOTE: filenames are singular ("notification", not "notifications")
  // to match the files you actually have in uniqueue_api/.
  checkNotifications: `${API_URL}/check_notification.php`,
  getNotifications: `${API_URL}/get_notification.php`,
  markNotificationsRead: `${API_URL}/mark_notification_read.php`,

};