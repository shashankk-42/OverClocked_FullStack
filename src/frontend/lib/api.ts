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
  checkIn: (appointmentId: string) =>
    apiClient.post(`/appointments/check-in/${appointmentId}`),
  getQueue: (doctorId: string) => apiClient.get(`/appointments/queue/${doctorId}`),
  updateStatus: (id: string, status: string) =>
    apiClient.patch(`/appointments/${id}/status`, null, { params: { status } }),
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
};

// ─── Pharmacy ─────────────────────────────────────────────────
export const pharmacyApi = {
  pendingPrescriptions: () => apiClient.get('/pharmacy/prescriptions/pending'),
  dispense: (prescriptionId: string) =>
    apiClient.post(`/pharmacy/dispense/${prescriptionId}`),
  pay: (billId: string, paymentMethod?: string) =>
    apiClient.post('/pharmacy/pay', { bill_id: billId, payment_method: paymentMethod || 'simulated' }),
  inventory: () => apiClient.get('/pharmacy/inventory'),
  lowStock: () => apiClient.get('/pharmacy/inventory/low-stock'),
  bills: () => apiClient.get('/pharmacy/bills'),
  patientBills: (patientId: string) => apiClient.get(`/pharmacy/bills/${patientId}`),
};

// ─── AI ───────────────────────────────────────────────────────
export const aiApi = {
  triage: (symptoms: string) => apiClient.post('/ai/triage', { symptoms }),
  soapNotes: (transcript: string, patientId: string, appointmentId?: string) =>
    apiClient.post('/ai/soap-notes', { transcript, patient_id: patientId, appointment_id: appointmentId }),
  generatePrescription: (diagnosis: string, patientId: string) =>
    apiClient.post('/ai/prescription/generate', { diagnosis, patient_id: patientId }),
  drugInteraction: (medicines: string[], patientId?: string) =>
    apiClient.post('/ai/drug-interaction', medicines, { params: { patient_id: patientId } }),
  altMedicine: (medicineName: string, diagnosis: string, patientId?: string) =>
    apiClient.post('/ai/alt-medicine', { medicine_name: medicineName, diagnosis, patient_id: patientId }),
  explainRx: (prescriptionId: string) =>
    apiClient.post(`/ai/explain-rx/${prescriptionId}`),
  chat: (message: string) => apiClient.post('/ai/chat', { message }),
};
