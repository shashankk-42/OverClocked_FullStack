import json
from app.ai.gemini_client import call_gemini


async def generate_soap_notes(transcript: str, patient_context: dict) -> dict:
    """
    Convert doctor's notes/transcript to structured SOAP format.
    Uses Gemini Pro for structured clinical note generation.
    """
    prompt = f"""You are a medical documentation specialist. Convert the following doctor's consultation notes into a structured SOAP note.

PATIENT CONTEXT:
- Age: {patient_context.get('age', 'Unknown')}
- Gender: {patient_context.get('gender', 'Unknown')}
- Chief Complaint: {patient_context.get('chief_complaint', 'Not specified')}
- Known Conditions: {patient_context.get('conditions', 'None')}

DOCTOR'S RAW NOTES/TRANSCRIPT:
{transcript}

Generate a structured SOAP note. Respond ONLY with valid JSON:
{{
  "subjective": "Patient's reported symptoms and complaints in medical language",
  "objective": "Examination findings, vitals, observations",
  "assessment": "Diagnosis or differential diagnoses",
  "plan": "Treatment plan, medications, follow-up instructions",
  "diagnosis_codes": ["ICD-10 codes if applicable"],
  "vital_signs": {{
    "blood_pressure": "extracted if mentioned",
    "temperature": "extracted if mentioned",
    "pulse": "extracted if mentioned",
    "spo2": "extracted if mentioned"
  }}
}}"""

    try:
        response = await call_gemini(prompt, model="pro")
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        return json.loads(cleaned.strip())
    except Exception:
        return {
            "subjective": transcript,
            "objective": "Examination findings not structured",
            "assessment": "Diagnosis pending",
            "plan": "Treatment plan to be determined",
            "diagnosis_codes": [],
            "vital_signs": {},
        }
