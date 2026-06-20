from pydantic import BaseModel, EmailStr
from typing import Optional
import uuid
from datetime import date, datetime


# Auth
class LoginRequest(BaseModel):
    identifier: str  # email or phone
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: str
    linked_id: Optional[str] = None


# Patient
class PatientRegisterRequest(BaseModel):
    name: str
    phone: str
    password: str
    email: Optional[str] = None
    dob: Optional[str] = None  # YYYY-MM-DD
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    allergies: Optional[str] = None


class PatientResponse(BaseModel):
    id: str
    pid: str
    name: str
    phone: str
    email: Optional[str]
    dob: Optional[date]
    gender: Optional[str]
    blood_group: Optional[str]
    allergies: Optional[str]
    emergency_contact_name: Optional[str]
    emergency_contact_phone: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class PatientUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    blood_group: Optional[str] = None
    allergies: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    address: Optional[str] = None


# Doctor
class DoctorResponse(BaseModel):
    id: str
    name: str
    specialization: str
    department: str
    email: str
    bio: Optional[str]
    available_days: Optional[str]

    class Config:
        from_attributes = True


# Appointment
class BookAppointmentRequest(BaseModel):
    doctor_id: str
    scheduled_at: datetime
    chief_complaint: Optional[str] = None
    priority: str = "medium"
    triage_department: Optional[str] = None


class AppointmentResponse(BaseModel):
    id: str
    patient_id: str
    doctor_id: str
    scheduled_at: datetime
    status: str
    queue_position: Optional[int]
    chief_complaint: Optional[str]
    priority: str
    triage_department: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class CheckInRequest(BaseModel):
    appointment_id: str


# Prescription
class MedicineItem(BaseModel):
    name: str
    generic_name: Optional[str] = None
    dosage: str
    form: Optional[str] = "tablet"
    frequency: str
    duration: str
    instructions: Optional[str] = None
    quantity: Optional[int] = 10


class CreatePrescriptionRequest(BaseModel):
    patient_id: str
    appointment_id: Optional[str] = None
    diagnosis: str
    medicines: list[MedicineItem] = []
    soap_notes: Optional[dict] = None
    drug_interactions: Optional[list] = None


class PrescriptionResponse(BaseModel):
    id: str
    patient_id: str
    doctor_id: str
    appointment_id: Optional[str]
    diagnosis: Optional[str]
    medicines: Optional[list]
    soap_notes: Optional[dict]
    status: str
    drug_interactions: Optional[list]
    created_at: datetime

    class Config:
        from_attributes = True


# AI
class TriageRequest(BaseModel):
    symptoms: str


class SOAPRequest(BaseModel):
    transcript: str
    patient_id: str
    appointment_id: Optional[str] = None


class PrescriptionGenRequest(BaseModel):
    diagnosis: str
    patient_id: str


class AltMedicineRequest(BaseModel):
    medicine_name: str
    diagnosis: str
    patient_id: Optional[str] = None


class ChatRequest(BaseModel):
    message: str


class RxExplainRequest(BaseModel):
    prescription_id: str


# Bill
class BillResponse(BaseModel):
    id: str
    patient_id: str
    prescription_id: Optional[str]
    items: Optional[list]
    subtotal: float
    tax: float
    total_amount: float
    payment_status: str
    payment_method: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class PaymentRequest(BaseModel):
    bill_id: str
    payment_method: str = "simulated"


# Pharmacy
class PharmacyItemResponse(BaseModel):
    id: str
    medicine_name: str
    generic_name: Optional[str]
    category: Optional[str]
    stock: int
    unit: str
    price_per_unit: float
    low_stock_threshold: int

    class Config:
        from_attributes = True


# Error
class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None
