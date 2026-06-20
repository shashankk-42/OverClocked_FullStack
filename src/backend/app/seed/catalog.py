"""Static catalog data for MediFlow Smart Hospital seed (hospital.md + db-design.txt)."""

HOSPITAL_NAME = "MediFlow Smart Hospital"

# db-design.txt — 34 doctors across departments
DOCTOR_DEPARTMENTS = [
    ("General Medicine", "General Physician", 8),
    ("Cardiology", "Cardiologist", 3),
    ("Neurology", "Neurologist", 2),
    ("Orthopedics", "Orthopedic Surgeon", 3),
    ("Pediatrics", "Pediatrician", 3),
    ("Dermatology", "Dermatologist", 2),
    ("ENT", "ENT Specialist", 2),
    ("Ophthalmology", "Ophthalmologist", 2),
    ("Gynecology", "Gynecologist", 3),
    ("Pulmonology", "Pulmonologist", 2),
    ("Radiology", "Radiologist", 2),
    ("Pathology", "Pathologist", 2),
]

DOCTOR_FIRST_NAMES = [
    "Priya", "Rajesh", "Ananya", "Vikram", "Meera", "Arun", "Sunita", "Nikhil",
    "Kavita", "Rahul", "Deepa", "Sanjay", "Lakshmi", "Amit", "Neha", "Rohan",
    "Pooja", "Manish", "Divya", "Karan", "Shreya", "Varun", "Anjali", "Harish",
    "Swati", "Gaurav", "Nisha", "Aditya", "Ritu", "Mohit", "Tanvi", "Ashok",
    "Preeti", "Suresh",
]

DOCTOR_LAST_NAMES = [
    "Sharma", "Kumar", "Nair", "Singh", "Patel", "Reddy", "Joshi", "Gupta",
    "Iyer", "Menon", "Desai", "Kapoor", "Malhotra", "Verma", "Chopra", "Bose",
    "Mehta", "Agarwal", "Pillai", "Saxena", "Khanna", "Das", "Rao", "Banerjee",
    "Chatterjee", "Mishra", "Tiwari", "Pandey", "Yadav", "Shah", "Kulkarni", "Naidu",
    "Shetty", "Bhatt",
]

# Primary demo doctor (must stay first in generation order)
PRIMARY_DOCTOR = {
    "name": "Dr. Priya Sharma",
    "specialization": "General Physician",
    "department": "General Medicine",
    "email": "dr.sharma@mediflow.ai",
}

DEMO_PATIENT = {
    "name": "Amit Desai",
    "phone": "9876543210",
    "password": "demo1234",
    "gender": "Male",
    "blood_group": "O+",
    "allergies": "Penicillin",
    "dob_year": 1982,
    "dob_month": 3,
    "dob_day": 15,
    "email": "amit.desai@example.com",
    "address": "Ground Floor, MediFlow Smart Hospital Campus, Pune",
    "emergency_contact_name": "Sneha Desai",
    "emergency_contact_phone": "9876501234",
}

STAFF_USERS = [
    {"email": "reception@mediflow.ai", "password": "demo1234", "role": "receptionist"},
    {"email": "pharmacist@mediflow.ai", "password": "demo1234", "role": "pharmacist"},
    {"email": "admin@mediflow.ai", "password": "demo1234", "role": "admin"},
    {"email": "nurse@mediflow.ai", "password": "demo1234", "role": "nurse"},
]

# db-design.txt medicine categories (200 total)
MEDICINE_CATEGORIES = [
    ("Cardiology", 30),
    ("Diabetes", 20),
    ("Antibiotics", 40),
    ("Painkillers", 25),
    ("Emergency Drugs", 15),
    ("Respiratory", 20),
    ("Dermatology", 15),
    ("Pediatrics", 20),
    ("General", 15),
]

MEDICINE_BASE_NAMES = {
    "Cardiology": ["Amlodipine", "Atorvastatin", "Clopidogrel", "Carvedilol", "Enalapril", "Losartan", "Metoprolol", "Ramipril", "Rosuvastatin", "Telmisartan"],
    "Diabetes": ["Metformin", "Glimepiride", "Sitagliptin", "Empagliflozin", "Insulin Glargine", "Insulin Aspart", "Gliclazide", "Pioglitazone", "Voglibose", "Dapagliflozin"],
    "Antibiotics": ["Azithromycin", "Amoxicillin", "Ciprofloxacin", "Ceftriaxone", "Doxycycline", "Metronidazole", "Cefixime", "Levofloxacin", "Clarithromycin", "Cephalexin"],
    "Painkillers": ["Paracetamol", "Ibuprofen", "Diclofenac", "Tramadol", "Naproxen", "Aceclofenac", "Piroxicam", "Ketorolac", "Aspirin", "Etoricoxib"],
    "Emergency Drugs": ["Adrenaline", "Atropine", "Nitroglycerin", "Hydrocortisone", "Salbutamol Neb", "Diazepam", "Magnesium Sulfate", "Amiodarone"],
    "Respiratory": ["Salbutamol", "Budesonide", "Montelukast", "Theophylline", "Ipratropium", "Formoterol", "Levocetirizine", "Ambroxol"],
    "Dermatology": ["Cetirizine", "Betamethasone", "Clotrimazole", "Mupirocin", "Permethrin", "Calamine", "Fusidic Acid", "Hydroxyzine"],
    "Pediatrics": ["Paracetamol Drops", "Amoxicillin Syrup", "Zinc Syrup", "ORS", "Salbutamol Syrup", "Cefixime Syrup", "Iron Drops", "Vitamin D Drops"],
    "General": ["Omeprazole", "Pantoprazole", "Vitamin D3", "Calcium Carbonate", "Multivitamin", "ORS Powder", "ORS Sachet"],
}

REPORT_TYPES = [
    ("blood_test", 500),
    ("xray", 150),
    ("mri", 60),
    ("ct_scan", 80),
    ("ultrasound", 100),
]

COMPLAINTS = [
    "Routine follow-up",
    "Chest pain and breathlessness",
    "Persistent headache",
    "Knee pain after fall",
    "Skin rash and itching",
    "Fever and cough",
    "Abdominal pain",
    "Diabetes review",
    "Hypertension check",
    "Child vaccination visit",
    "Eye strain and blurred vision",
    "Ear pain and congestion",
    "Back pain",
    "Anxiety and sleep issues",
    "Annual health screening",
]

DIAGNOSES = [
    "Type 2 Diabetes Mellitus — controlled",
    "Essential Hypertension",
    "Acute upper respiratory infection",
    "Osteoarthritis of knee",
    "Allergic dermatitis",
    "Migraine without aura",
    "Gastroesophageal reflux disease",
    "Vitamin D deficiency",
    "Anemia — iron deficiency",
    "Asthma — stable",
    "Urinary tract infection",
    "Coronary artery disease — stable",
]

BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
GENDERS = ["Male", "Female", "Other"]

INSURANCE_PROVIDERS = [
    "Star Health Insurance",
    "HDFC ERGO Health",
    "ICICI Lombard Health",
    "Care Health Insurance",
    "Niva Bupa Health",
]

JOURNEY_STEPS = [
    ("Registration", "Reception", "Ground", None),
    ("Vitals Check", "Nursing", "First", None),
    ("Consultation", "OPD", "First", None),
    ("Lab Tests", "Laboratory", "First", "Lab-1"),
    ("Pharmacy", "Pharmacy", "Ground", "PH-01"),
    ("Billing", "Billing", "Ground", "BILL-01"),
]

# db-design.txt scale targets
TARGETS = {
    "patients": 500,
    "medicines": 200,
    "past_appointments": 1500,
    "upcoming_appointments": 120,
    "prescriptions": 1200,
    "reports": 890,
    "bills": 1500,
    "beds": 150,
    "admitted_patients": 50,
    "icu_patients": 10,
    "emergency_cases": 10,
    "today_opd": 30,
}
