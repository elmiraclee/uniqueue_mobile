export const IP_ADDRESS = "192.168.50.5";

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

  //DOCUMENT.TSX
  getDocuments: `${API_URL}/get_documents.php`,
  addDocument: `${API_URL}/add_documents.php`,
  updateDocument: `${API_URL}/update_documents.php`,
  deleteDocument: `${API_URL}/delete_documents.php`,

  //STAFF.TSX
  getStaff: `${API_URL}/get_staff.php`,
  addStaff: `${API_URL}/add_staff.php`,
  updateStaff: `${API_URL}/update_staff.php`,
  deleteStaff: `${API_URL}/delete_staff.php`,

  //WINDOW.TSX
  addWindow: `${API_URL}/add_window.php`,
  updateWindow: `${API_URL}/update_window.php`,
  deleteWindow: `${API_URL}/delete_window.php`,

  //OFFICE-QUEUE.TSX
  getOffice: `${API_URL}/get_offices.php`,

  //QUEUE.TSX
  // STUDENT QUEUE
  getStudentTransactions: `${API_URL}/get_student_transaction.php`,

  //PROFILE.TSX
  getStudentProfile: `${API_URL}/get_student_profile.php`,

  //HOME
   getCurrentQueue: `${API_URL}/get_current_queue.php`,
   cancelQueue: `${API_URL}/cancel_queue.php`,
   getQueueDetails: `${API_URL}/get_queue_details.php`,

  //LIVE QUEUE
  getLiveQueue: `${API_URL}/get_live_queue.php`,





};