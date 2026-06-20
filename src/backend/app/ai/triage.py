import json
from app.ai.gemini_client import call_gemini, clean_json_response


async def triage_symptoms(symptoms: str) -> dict:
    """
    Analyze patient symptoms and return department recommendation + priority.
    Uses Gemini Flash for speed.
    """
    prompt = f"""You are a medical triage specialist AI at a hospital. 
    
A patient described their symptoms as: "{symptoms}"

Analyze these symptoms and respond ONLY with a valid JSON object (no markdown, no explanation) with this exact structure:
{{
  "department": "Department name (e.g., General Medicine, Cardiology, Orthopedics, Neurology, Gynecology, Pediatrics, Dermatology, ENT, Ophthalmology, Gastroenterology, Psychiatry, Emergency)",
  "priority": "low|medium|high|emergency",
  "reasoning": "Brief 1-2 sentence explanation",
  "suggested_tests": ["list", "of", "suggested", "preliminary", "tests"],
  "do_not_delay": false
}}

Priority guide:
- emergency: chest pain, difficulty breathing, stroke symptoms, severe bleeding, unconscious
- high: high fever (>103°F), severe pain, suspected fracture, acute infection
- medium: moderate symptoms, follow-up needed, chronic condition review
- low: mild symptoms, routine checkup, preventive care"""

    try:
        response = await call_gemini(prompt, model="flash")
        return json.loads(clean_json_response(response))
    except (json.JSONDecodeError, Exception):
        return {
            "department": "General Medicine",
            "priority": "medium",
            "reasoning": "Unable to analyze symptoms. Please consult a general physician.",
            "suggested_tests": [],
            "do_not_delay": False,
        }
