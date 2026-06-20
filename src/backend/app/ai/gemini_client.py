import google.generativeai as genai
from app.config import settings

# Initialize Gemini
genai.configure(api_key=settings.gemini_api_key)

# Model instances
flash_model = genai.GenerativeModel("gemini-1.5-flash")
pro_model = genai.GenerativeModel("gemini-1.5-pro")


async def call_gemini(prompt: str, model: str = "flash") -> str:
    """Call Gemini with retry logic."""
    import asyncio

    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    selected_model = flash_model if model == "flash" else pro_model

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
