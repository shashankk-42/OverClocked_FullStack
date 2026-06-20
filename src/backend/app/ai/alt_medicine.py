import json
from app.ai.gemini_client import call_gemini, clean_json_response


async def suggest_alternatives(
    unavailable_medicine: str,
    diagnosis: str,
    patient_allergies: str = "",
) -> list[dict]:
    """
    Suggest alternative medicines when a medicine is out of stock.
    Uses Gemini Flash.
    """
    prompt = f"""You are a clinical pharmacist suggesting alternative medicines.

UNAVAILABLE MEDICINE: {unavailable_medicine}
PATIENT DIAGNOSIS: {diagnosis}
PATIENT ALLERGIES: {patient_allergies or 'None'}

Suggest 2-3 alternative medicines that can substitute. Respond ONLY with valid JSON:
[
  {{
    "name": "Alternative medicine name",
    "generic_name": "Generic name",
    "reason": "Why this is a good alternative",
    "notes": "Any dosage adjustments or special instructions",
    "equivalence": "equivalent|similar|different_class"
  }}
]"""

    try:
        response = await call_gemini(prompt, model="flash")
        return json.loads(clean_json_response(response))
    except Exception:
        return []


async def explain_prescription(medicines: list[dict], patient_name: str = "Patient") -> str:
    """
    Generate patient-friendly prescription explanation.
    Uses Gemini Flash.
    """
    medicines_text = "\n".join(
        [f"- {m.get('name', 'Medicine')} ({m.get('dosage', '')}): {m.get('frequency', '')} for {m.get('duration', '')}"
         for m in medicines]
    )

    prompt = f"""You are a friendly pharmacist explaining a prescription to a patient named {patient_name}.

PRESCRIPTION:
{medicines_text}

Write a clear, friendly, easy-to-understand explanation of:
1. What each medicine is for (in simple language, not medical jargon)
2. How and when to take each medicine
3. Important warnings or side effects to watch for
4. When to contact the doctor

Keep it conversational, warm, and in simple English. Format as readable paragraphs, not JSON."""

    try:
        return await call_gemini(prompt, model="flash")
    except Exception:
        return "Please follow your doctor's prescription instructions carefully. Contact your doctor if you experience any side effects."


def offline_chat_response(message: str, patient_context: dict) -> str:
    lower = message.lower()
    medications = patient_context.get("medications")
    appointments = patient_context.get("appointments")
    name = patient_context.get("name", "there")

    if any(word in lower for word in ["visiting hour", "visitor", "visiting time", "open hour", "hours open"]):
        return (
            "MediFlow Hospital visiting hours are typically 10:00 AM to 8:00 PM daily. "
            "ICU visits are usually limited to 11:00 AM to 1:00 PM and 4:00 PM to 6:00 PM. "
            "Please confirm with reception for ward-specific timings."
        )
    if any(word in lower for word in ["lab report", "test result", "blood test", "read my report", "lab result"]):
        return (
            "Your lab reports and test results are available under Test Results and Medical History. "
            "Compare your values with the reference ranges shown on each report, and contact your doctor "
            "if anything is marked critical or unclear."
        )
    if "metformin" in lower:
        return (
            "Metformin is commonly prescribed to help control blood sugar in diabetes. "
            "It is usually taken with meals to reduce stomach upset. "
            "Contact your doctor before stopping or changing the dose."
        )
    if any(word in lower for word in ["side effect", "side effects"]):
        med_list = medications or "your prescribed medicines"
        return (
            f"Side effects depend on the specific medicine. Current medications on file: {med_list}. "
            "Common issues may include nausea, dizziness, or rash — contact your doctor or pharmacist "
            "if symptoms persist or worsen."
        )
    if any(word in lower for word in ["next appointment", "when is my appointment", "upcoming appointment"]):
        appt = appointments or "I do not see an upcoming appointment in your records yet."
        return (
            f"Hi {name}, you can view and manage appointments from your Dashboard. "
            f"{appt} Use Book Appointment to schedule a new visit."
        )
    if any(word in lower for word in ["appointment", "doctor", "queue", "scheduled"]):
        return (
            "Your appointment information is available in the Dashboard and Medical History sections. "
            f"{appointments or 'I do not see an upcoming appointment in your current context.'} "
            "For urgent scheduling changes, please contact reception."
        )
    if any(word in lower for word in ["medicine", "medication", "tablet", "prescription"]):
        return (
            "I can help explain your current medicines in simple terms. "
            f"Current medications on file: {medications or 'none listed yet'}. "
            "Please follow the prescription exactly and contact your doctor or pharmacist before changing a dose."
        )
    if any(word in lower for word in ["emergency", "chest pain", "breathing", "severe"]):
        return (
            "If this may be an emergency, please call emergency services or go to the nearest emergency "
            "department immediately. Do not wait for an online response."
        )
    return (
        "I can help with appointments, medicine explanations, hospital navigation, and general health questions. "
        "Try asking about visiting hours, your medications, or your next appointment."
    )


async def ai_chat_response(message: str, patient_context: dict) -> str:
    """
    General AI assistant for patient queries.
    """
    prompt = f"""You are MediFlow AI, a helpful medical assistant. You help patients understand their health, medications, and navigate hospital services.

PATIENT CONTEXT:
- Name: {patient_context.get('name', 'Patient')}
- Current Medications: {patient_context.get('medications', 'None')}
- Upcoming Appointments: {patient_context.get('appointments', 'None')}

PATIENT MESSAGE: {message}

Respond helpfully and in simple language. If it's a medical emergency, advise to call emergency services immediately.
Do NOT diagnose or prescribe. You can explain medications, general health tips, and help navigate hospital services.
Keep your response concise (2-4 sentences) and warm."""

    try:
        return await call_gemini(prompt, model="flash")
    except Exception:
        return offline_chat_response(message, patient_context)
