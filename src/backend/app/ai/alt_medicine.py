import json
from app.ai.gemini_client import call_gemini


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
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        return json.loads(cleaned.strip())
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
        lower = message.lower()
        medications = patient_context.get("medications")
        appointments = patient_context.get("appointments")
        if any(word in lower for word in ["appointment", "visit", "doctor", "queue"]):
            return f"Your appointment information is available in the Dashboard and Medical History sections. {appointments or 'I do not see an upcoming appointment in your current context.'} For urgent scheduling changes, please contact reception."
        if any(word in lower for word in ["medicine", "medication", "tablet", "prescription", "metformin", "side effect"]):
            return f"I can help explain your current medicines in simple terms. Current medications on file: {medications or 'none listed yet'}. Please follow the prescription exactly and contact your doctor or pharmacist before changing a dose."
        if any(word in lower for word in ["emergency", "chest pain", "breathing", "severe"]):
            return "If this may be an emergency, please call emergency services or go to the nearest emergency department immediately. Do not wait for an online response."
        return "I can help with appointments, medicine explanations, hospital navigation, and general health questions. Live Gemini is not configured in this demo, so I am using a safe built-in response mode."
