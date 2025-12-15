import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

model = genai.GenerativeModel('gemini-2.0-flash-exp', tools='google_search')

try:
    print("Sending message with tools='google_search'...")
    response = model.generate_content("Who is the current president of France?")
    print(response.text)
except Exception as e:
    print(f"Error: {e}")
