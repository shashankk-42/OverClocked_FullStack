import json
from app.ai.gemini_client import call_gemini


async def generate_patient_summary(patient_data: dict) -> dict:
    """
    Generate an AI clinical summary from patient history.
    Uses Gemini Pro for complex reasoning.
    """
    prompt = f"""You are a senior clinical physician reviewing a patient's complete medical history.

PATIENT DATA:
Name: {patient_data.get('name', 'Unknown')}
Age: {patient_data.get('age', 'Unknown')}
Gender: {patient_data.get('gender', 'Unknown')}
Blood Group: {patient_data.get('blood_group', 'Unknown')}
Known Allergies: {patient_data.get('allergies', 'None reported')}

VISIT HISTORY:
{patient_data.get('visit_history', 'No previous visits')}

RECENT PRESCRIPTIONS:
{patient_data.get('prescriptions', 'None')}

RECENT REPORTS:
{patient_data.get('reports', 'None')}

Generate a comprehensive clinical summary. Respond ONLY with a valid JSON object:
{{
  "summary": "2-3 sentence clinical overview of this patient",
  "active_conditions": ["list of current/chronic conditions"],
  "current_medications": ["list of current medications if any"],
  "risk_level": "low|moderate|high",
  "risk_factors": ["key risk factors"],
  "key_alerts": ["important alerts for treating physician"],
  "last_visit_reason": "reason for last visit if available",
  "recommended_follow_ups": ["suggested follow-up actions"]
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
            "summary": "Patient summary generation failed. Please review records manually.",
            "active_conditions": [],
            "current_medications": [],
            "risk_level": "unknown",
            "risk_factors": [],
            "key_alerts": ["AI summary unavailable — review patient history manually"],
            "last_visit_reason": "Unknown",
            "recommended_follow_ups": [],
        }
