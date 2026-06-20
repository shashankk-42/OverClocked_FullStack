import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('mediflow_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 — redirect to login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('mediflow_token');
        localStorage.removeItem('mediflow_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;

// ─── Auth ────────────────────────────────────────────────────
export const authApi = {
  login: (identifier: string, password: string) =>
    apiClient.post('/auth/login', { identifier, password }),
  register: (data: Record<string, unknown>) =>
    apiClient.post('/auth/register/patient', data),
  me: () => apiClient.get('/auth/me'),
};

// ─── Patients ────────────────────────────────────────────────
export const patientsApi = {
  me: () => apiClient.get('/patients/me'),
  getByPid: (pid: string) => apiClient.get(`/patients/pid/${pid}`),
  search: (q: string) => apiClient.get('/patients/search', { params: { q } }),
  updateMe: (data: Record<string, unknown>) => apiClient.patch('/patients/me', data),
};

// ─── Appointments ────────────────────────────────────────────
export const appointmentsApi = {
  getDoctors: (department?: string) =>
    apiClient.get('/appointments/doctors', { params: { department } }),
  getSlots: (doctorId: string, date: string) =>
    apiClient.get(`/appointments/slots/${doctorId}`, { params: { date } }),
  book: (data: Record<string, unknown>) => apiClient.post('/appointments/book', data),
  myAppointments: () => apiClient.get('/appointments/my'),
  today: () => apiClient.get('/appointments/today'),
  pendingApproval: () => apiClient.get('/appointments/pending-approval'),
  checkIn: (appointmentId: string) =>
    apiClient.post(`/appointments/check-in/${appointmentId}`),
  getQueue: (doctorId: string) => apiClient.get(`/appointments/queue/${doctorId}`),
  updateStatus: (id: string, status: string) =>
    apiClient.patch(`/appointments/${id}/status`, null, { params: { status } }),
  updatePresence: (id: string, status: string, notes?: string) =>
    apiClient.patch(`/appointments/${id}/presence`, { status, notes }),
};

// ─── Consultations ────────────────────────────────────────────
export const consultationsApi = {
  getPatientSummary: (patientId: string) =>
    apiClient.get(`/consultations/patient/${patientId}/summary`),
  getPatientHistory: (patientId: string) =>
    apiClient.get(`/consultations/patient/${patientId}/history`),
  listPrescriptions: () => apiClient.get('/consultations/prescriptions'),
  createPrescription: (data: Record<string, unknown>) =>
    apiClient.post('/consultations/prescription', data),
  getPrescription: (id: string) => apiClient.get(`/consultations/prescription/${id}`),
  downloadPrescriptionPdf: (id: string) =>
    apiClient.get(`/consultations/prescription/${id}/pdf`, { responseType: 'blob' }),
};

// ─── Billing ──────────────────────────────────────────────────
export const billingApi = {
  config: () => apiClient.get('/billing/config'),
  myBills: () => apiClient.get('/billing/my'),
  getAppointmentBill: (appointmentId: string) =>
    apiClient.get(`/billing/appointment/${appointmentId}`),
  sendPaymentLink: (appointmentId: string) =>
    apiClient.post(`/billing/appointment/${appointmentId}/send-payment-link`),
  createOrder: (billId: string) => apiClient.post(`/billing/${billId}/create-order`),
  payBill: (billId: string, paymentMethod: string, gatewayReference?: string) =>
    apiClient.post(`/billing/${billId}/pay`, {
      payment_method: paymentMethod,
      gateway_reference: gatewayReference,
    }),
  receipt: (transactionId: string) => apiClient.get(`/billing/receipts/${transactionId}`),
  verifyPayment: (data: {
    bill_id: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => apiClient.post('/billing/verify', data),
};

export const getUploadsBaseUrl = () =>
  (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace('/api/v1', '');

// ─── Pharmacy ─────────────────────────────────────────────────
export const pharmacyApi = {
  pendingPrescriptions: () => apiClient.get('/pharmacy/prescriptions/pending'),
  orders: (status?: string) => apiClient.get('/pharmacy/orders', { params: { status } }),
  approveOrder: (orderId: string) => apiClient.post(`/pharmacy/orders/${orderId}/approve`),
  pickupChoice: (orderId: string, collectFromHospital: boolean) =>
    apiClient.post(`/pharmacy/orders/${orderId}/pickup-choice`, { collect_from_hospital: collectFromHospital }),
  sendPaymentLink: (orderId: string) =>
    apiClient.post(`/pharmacy/orders/${orderId}/send-payment-link`),
  updateOrderStatus: (orderId: string, status: string, notes?: string) =>
    apiClient.patch(`/pharmacy/orders/${orderId}/status`, { status, notes }),
  dispense: (prescriptionId: string) =>
    apiClient.post(`/pharmacy/dispense/${prescriptionId}`),
  pay: (billId: string, paymentMethod?: string) =>
    apiClient.post('/pharmacy/pay', { bill_id: billId, payment_method: paymentMethod || 'simulated' }),
  inventory: () => apiClient.get('/pharmacy/inventory'),
  lowStock: () => apiClient.get('/pharmacy/inventory/low-stock'),
  bills: () => apiClient.get('/pharmacy/bills'),
  patientBills: (patientId: string) => apiClient.get(`/pharmacy/bills/${patientId}`),
};

export const navigationApi = {
  locations: (params?: Record<string, unknown>) => apiClient.get('/navigation/locations', { params }),
  floors: () => apiClient.get('/navigation/floors'),
  route: (destinationCode: string, startCode = 'reception') =>
    apiClient.get('/navigation/route', { params: { destination_code: destinationCode, start_code: startCode } }),
  appointmentLocation: (appointmentId: string) => apiClient.get(`/navigation/appointment/${appointmentId}`),
  currentJourney: () => apiClient.get('/navigation/journey/current'),
};

export const nurseApi = {
  dashboard: () => apiClient.get('/nurse/dashboard'),
  recordVitals: (data: Record<string, unknown>) => apiClient.post('/nurse/vitals', data),
  updateAssignment: (assignmentId: string, data: Record<string, unknown>) =>
    apiClient.patch(`/nurse/assignments/${assignmentId}`, data),
  administerMedication: (data: Record<string, unknown>) =>
    apiClient.post('/nurse/medications/administer', data),
  addNote: (data: Record<string, unknown>) => apiClient.post('/nurse/notes', data),
  requestDoctorReview: (data: Record<string, unknown>) => apiClient.post('/nurse/doctor-review', data),
  escalateEmergency: (data: Record<string, unknown>) => apiClient.post('/nurse/emergencies', data),
};

// ─── AI ───────────────────────────────────────────────────────
export const aiApi = {
  triage: (symptoms: string) => apiClient.post('/ai/triage', { symptoms }),
  soapNotes: (transcript: string, patientId: string, appointmentId?: string) =>
    apiClient.post('/ai/soap-notes', { transcript, patient_id: patientId, appointment_id: appointmentId }),
  generatePrescription: (diagnosis: string, patientId: string) =>
    apiClient.post('/ai/prescription/generate', { diagnosis, patient_id: patientId }),
  drugInteraction: (medicines: string[], patientId?: string) =>
    apiClient.post('/ai/drug-interaction', { medicines, patient_id: patientId }),
  altMedicine: (medicineName: string, diagnosis: string, patientId?: string) =>
    apiClient.post('/ai/alt-medicine', { medicine_name: medicineName, diagnosis, patient_id: patientId }),
  explainRx: (prescriptionId: string) =>
    apiClient.post(`/ai/explain-rx/${prescriptionId}`),
  chat: (message: string) => apiClient.post('/ai/chat', { message }),
};

// Enhancements
export const enhancementsApi = {
  auditLogs: (params?: Record<string, unknown>) =>
    apiClient.get('/enhancements/audit-logs', { params }),
  notifications: () => apiClient.get('/enhancements/notifications'),
  markNotificationRead: (id: string) =>
    apiClient.patch(`/enhancements/notifications/${id}/read`),

  createEmergency: (data: Record<string, unknown>) =>
    apiClient.post('/enhancements/emergencies', data),
  emergencies: (params?: Record<string, unknown>) =>
    apiClient.get('/enhancements/emergencies', { params }),
  assignEmergency: (id: string, assignedResponders: Record<string, unknown>[]) =>
    apiClient.patch(`/enhancements/emergencies/${id}/assign`, { assigned_responders: assignedResponders }),
  updateEmergencyStatus: (id: string, status: string, notes?: string) =>
    apiClient.patch(`/enhancements/emergencies/${id}/status`, { status, notes }),

  createFollowUpPlan: (data: Record<string, unknown>) =>
    apiClient.post('/enhancements/follow-ups/plans', data),
  myFollowUps: () => apiClient.get('/enhancements/follow-ups/my'),
  followUpReview: () => apiClient.get('/enhancements/follow-ups/review'),
  submitFollowUp: (id: string, data: Record<string, unknown>) =>
    apiClient.post(`/enhancements/follow-ups/${id}/responses`, data),
  scoreFollowUp: (id: string) =>
    apiClient.post(`/enhancements/follow-ups/${id}/risk-score`),
  reviewFollowUp: (id: string, status: string, notes?: string) =>
    apiClient.patch(`/enhancements/follow-ups/${id}/review`, { status, notes }),

  medicationTimeline: (patientId: string) =>
    apiClient.get(`/enhancements/medications/timeline/${patientId}`),
  registerDispenser: (data: Record<string, unknown>) =>
    apiClient.post('/enhancements/devices/dispensers', data),
  dispensers: (patientId?: string) =>
    apiClient.get('/enhancements/devices/dispensers', { params: { patient_id: patientId } }),
  syncDispenser: (id: string) =>
    apiClient.post(`/enhancements/devices/dispensers/${id}/sync`),
  dispenserEvent: (id: string, data: Record<string, unknown>) =>
    apiClient.post(`/enhancements/devices/dispensers/${id}/events`, data),

  waitPrediction: (appointmentId: string) =>
    apiClient.get(`/enhancements/appointments/${appointmentId}/wait-prediction`),
  createWaitlistEntry: (data: Record<string, unknown>) =>
    apiClient.post('/enhancements/appointments/waitlist', data),
  myWaitlist: () => apiClient.get('/enhancements/appointments/waitlist/my'),
  waitlist: () => apiClient.get('/enhancements/appointments/waitlist'),
  createEarlierOffer: (data: Record<string, unknown>) =>
    apiClient.post('/enhancements/appointments/offers', data),
  acceptEarlierOffer: (id: string) =>
    apiClient.post(`/enhancements/appointments/offers/${id}/accept`),
  recoveryOptions: (appointmentId: string) =>
    apiClient.get(`/enhancements/appointments/${appointmentId}/recovery-options`),

  createRoom: (data: Record<string, unknown>) =>
    apiClient.post('/enhancements/rooms', data),
  createBed: (data: Record<string, unknown>) =>
    apiClient.post('/enhancements/beds', data),
  roomAvailability: () => apiClient.get('/enhancements/rooms/availability'),
  publicRoomAvailability: () => apiClient.get('/enhancements/rooms/public-availability'),
  updateBedStatus: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/enhancements/beds/${id}/status`, data),

  prescriptionCostAnalysis: (prescriptionId: string) =>
    apiClient.get(`/enhancements/prescriptions/${prescriptionId}/cost-analysis`),
  createSubstitutionRequest: (prescriptionId: string, data: Record<string, unknown>) =>
    apiClient.post(`/enhancements/prescriptions/${prescriptionId}/substitution-requests`, data),
  approveSubstitutionRequest: (id: string, status: string, notes?: string) =>
    apiClient.patch(`/enhancements/substitution-requests/${id}/approve`, { status, notes }),

  createFamily: (data: Record<string, unknown>) =>
    apiClient.post('/enhancements/families', data),
  addFamilyMember: (familyId: string, data: Record<string, unknown>) =>
    apiClient.post(`/enhancements/families/${familyId}/members`, data),
  myFamilies: () => apiClient.get('/enhancements/families/my'),

  createInsurancePolicy: (data: Record<string, unknown>) =>
    apiClient.post('/enhancements/insurance/policies', data),
  insurancePolicies: (patientId?: string) =>
    apiClient.get('/enhancements/insurance/policies', { params: { patient_id: patientId } }),
  eligibilityCheck: (data: Record<string, unknown>) =>
    apiClient.post('/enhancements/insurance/eligibility-checks', data),
  createClaim: (data: Record<string, unknown>) =>
    apiClient.post('/enhancements/insurance/claims', data),
  claims: () => apiClient.get('/enhancements/insurance/claims'),

  startAssistantConversation: (data: Record<string, unknown>) =>
    apiClient.post('/enhancements/assistant/conversations', data),
  sendAssistantMessage: (conversationId: string, message: string) =>
    apiClient.post(`/enhancements/assistant/conversations/${conversationId}/messages`, { message }),
  escalateAssistantConversation: (conversationId: string, data: Record<string, unknown>) =>
    apiClient.post(`/enhancements/assistant/conversations/${conversationId}/escalate`, data),

  createProfileEntry: (data: Record<string, unknown>) =>
    apiClient.post('/enhancements/profile/entries', data),
  comprehensiveProfile: (patientId: string) =>
    apiClient.get(`/enhancements/profile/${patientId}`),
  createVital: (data: Record<string, unknown>) =>
    apiClient.post('/enhancements/profile/vitals', data),

  createQrAccessToken: (data: Record<string, unknown>) =>
    apiClient.post('/enhancements/qr-access/tokens', data),
  readQrAccess: (token: string) => apiClient.get(`/enhancements/qr-access/${token}`),
  shareReport: (reportId: string, data: Record<string, unknown>) =>
    apiClient.post(`/enhancements/reports/${reportId}/share`, data),

  createCareTeam: (data: Record<string, unknown>) =>
    apiClient.post('/enhancements/care-teams', data),
  careTeams: (patientId?: string) =>
    apiClient.get('/enhancements/care-teams', { params: { patient_id: patientId } }),
  addCareTeamMember: (teamId: string, data: Record<string, unknown>) =>
    apiClient.post(`/enhancements/care-teams/${teamId}/members`, data),
  createCareNote: (teamId: string, data: Record<string, unknown>) =>
    apiClient.post(`/enhancements/care-teams/${teamId}/notes`, data),
  createTreatmentPlan: (teamId: string, data: Record<string, unknown>) =>
    apiClient.post(`/enhancements/care-teams/${teamId}/treatment-plans`, data),
  createReferral: (data: Record<string, unknown>) =>
    apiClient.post('/enhancements/care-teams/referrals', data),

  createJourney: (data: Record<string, unknown>) =>
    apiClient.post('/enhancements/journeys', data),
  journeys: () => apiClient.get('/enhancements/journeys'),
  updateJourneyStep: (journeyId: string, stepId: string, status: string) =>
    apiClient.patch(`/enhancements/journeys/${journeyId}/steps/${stepId}`, { status }),
  myCurrentJourney: () => apiClient.get('/enhancements/journeys/my/current'),

  uploadVisualTriage: (data: FormData) =>
    apiClient.post('/enhancements/visual-triage/uploads', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  analyzeVisualTriage: (id: string, data?: Record<string, unknown>) =>
    apiClient.post(`/enhancements/visual-triage/${id}/analyze`, data || {}),
  getVisualTriage: (id: string) =>
    apiClient.get(`/enhancements/visual-triage/${id}`),
  visualTriageList: (patientId?: string) =>
    apiClient.get('/enhancements/visual-triage', { params: { patient_id: patientId } }),
};
