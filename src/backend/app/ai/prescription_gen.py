import json
from app.ai.gemini_client import call_gemini


def offline_prescription(diagnosis: str) -> list[dict]:
    """Rule-based fallback when AI is unavailable or returns nothing."""
    text = diagnosis.lower()
    meds: list[dict] = []

    if any(k in text for k in ("fever", "cough", "cold", "flu", "viral", "throat")):
        meds.extend([
            {
                "name": "Paracetamol",
                "generic_name": "Acetaminophen",
                "dosage": "500mg",
                "form": "tablet",
                "frequency": "three times daily",
                "duration": "5 days",
                "instructions": "Take after food; do not exceed 4g/day",
                "quantity": 15,
            },
            {
                "name": "Cetirizine",
                "generic_name": "Cetirizine",
                "dosage": "10mg",
                "form": "tablet",
                "frequency": "once daily at night",
                "duration": "5 days",
                "instructions": "May cause drowsiness",
                "quantity": 5,
            },
        ])
    elif any(k in text for k in ("headache", "migraine", "pain")):
        meds.append({
            "name": "Paracetamol",
            "generic_name": "Acetaminophen",
            "dosage": "500mg",
            "form": "tablet",
            "frequency": "as needed",
            "duration": "3 days",
            "instructions": "Take after food",
            "quantity": 9,
        })
    elif any(k in text for k in ("diabetes", "sugar", "glucose")):
        meds.append({
            "name": "Metformin",
            "generic_name": "Metformin",
            "dosage": "500mg",
            "form": "tablet",
            "frequency": "twice daily",
            "duration": "30 days",
            "instructions": "Take after meals",
            "quantity": 60,
        })
    elif any(k in text for k in ("hypertension", "bp", "blood pressure")):
        meds.append({
            "name": "Amlodipine",
            "generic_name": "Amlodipine",
            "dosage": "5mg",
            "form": "tablet",
            "frequency": "once daily",
            "duration": "30 days",
            "instructions": "Take at the same time each day",
            "quantity": 30,
        })
    else:
        meds.append({
            "name": "Paracetamol",
            "generic_name": "Acetaminophen",
            "dosage": "500mg",
            "form": "tablet",
            "frequency": "as needed",
            "duration": "5 days",
            "instructions": "Take after food for symptomatic relief",
            "quantity": 10,
        })

    return meds


async def generate_prescription(
    diagnosis: str,
    patient_context: dict,
) -> list[dict]:
    """
    Generate prescription suggestions from diagnosis.
    Uses Gemini Pro.
    """
    prompt = f"""You are a senior physician generating a prescription.

DIAGNOSIS: {diagnosis}

PATIENT CONTEXT:
- Age: {patient_context.get('age', 'Adult')}
- Gender: {patient_context.get('gender', 'Unknown')}
- Allergies: {patient_context.get('allergies', 'None')}
- Current Medications: {patient_context.get('current_medications', 'None')}
- Known Conditions: {patient_context.get('conditions', 'None')}

Generate a clinically appropriate prescription. Respond ONLY with a valid JSON array:
[
  {{
    "name": "Medicine brand name",
    "generic_name": "Generic/chemical name",
    "dosage": "e.g. 500mg",
    "form": "tablet|capsule|syrup|injection|cream|drops",
    "frequency": "e.g. twice daily|once daily|three times daily|as needed",
    "duration": "e.g. 5 days|30 days|ongoing",
    "instructions": "e.g. take after food, avoid alcohol",
    "quantity": 10
  }}
]

Important: Only suggest medications appropriate for the diagnosis. Include 1-4 medicines maximum."""

    try:
        response = await call_gemini(prompt, model="pro")
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        medicines = json.loads(cleaned.strip())
        if isinstance(medicines, list) and medicines:
            return medicines
    except Exception:
        pass

    return offline_prescription(diagnosis)


async def check_drug_interactions(medicines: list[str], allergies: str = "", current_meds: list[str] = None) -> dict:
    """
    Check for drug interactions and allergy conflicts.
    Uses Gemini Flash for speed.
    """
    current_meds = current_meds or []
    all_meds = medicines + current_meds

    prompt = f"""You are a clinical pharmacist checking for drug interactions and safety issues.

NEW MEDICINES BEING PRESCRIBED:
{', '.join(medicines)}

CURRENT MEDICATIONS (patient is already taking):
{', '.join(current_meds) if current_meds else 'None'}

KNOWN ALLERGIES:
{allergies or 'None reported'}

Analyze for: drug-drug interactions, allergy conflicts, duplicate medications, contraindications.

Respond ONLY with valid JSON:
{{
  "has_interactions": true|false,
  "severity": "none|mild|moderate|severe",
  "interactions": [
    {{
      "drugs": ["Drug A", "Drug B"],
      "type": "drug-drug|allergy|duplicate",
      "severity": "mild|moderate|severe",
      "description": "What can happen",
      "recommendation": "What to do"
    }}
  ],
  "safe_to_prescribe": true|false,
  "overall_recommendation": "Summary for the doctor"
}}"""

    try:
        response = await call_gemini(prompt, model="flash")
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        return json.loads(cleaned.strip())
    except Exception:
        return {
            "has_interactions": False,
            "severity": "none",
            "interactions": [],
            "safe_to_prescribe": True,
            "overall_recommendation": "Unable to check interactions automatically. Please verify manually.",
        }
