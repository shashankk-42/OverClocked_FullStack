import re
import asyncio
import google.generativeai as genai
from app.config import settings


def clean_json_response(text: str) -> str:
    """Strip markdown code fences from Gemini's response to get clean JSON."""
    text = text.strip()
    # Remove ```json ... ``` or ``` ... ``` fences
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


async def call_gemini(prompt: str, model: str = "flash") -> str:
    """Call Gemini with lazy initialization and retry logic."""
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    # Initialize lazily so misconfiguration is caught clearly at call time
    genai.configure(api_key=settings.gemini_api_key)
    selected_model = genai.GenerativeModel(
        "gemini-1.5-flash" if model == "flash" else "gemini-1.5-pro"
    )

    for attempt in range(3):
        try:
            response = await asyncio.to_thread(
                selected_model.generate_content, prompt
            )
            return response.text
        except Exception as e:
            if attempt == 2:
                raise e
            await asyncio.sleep(2 ** attempt)
    return ""
