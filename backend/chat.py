import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

model = genai.GenerativeModel('gemini-2.0-flash-exp')

async def generate_response(
    history: list,
    message: str,
    project_context: dict,
    web_search: bool = False
):
    system_instruction = f"""
    You are Forge AI, an expert software architect and coding assistant.
    You are helping a developer with their project: {project_context['name']}.
    Status: {project_context['status']}
    
    CONTEXT:
    The user has shared the following project context with you. Use it to answer questions accurately.
    
    FILES:
    {_format_files(project_context.get('files', []))}
    
    TASKS:
    {_format_tasks(project_context.get('tasks', []))}
    
    INSTRUCTIONS:
    - Be concise, technical, and helpful.
    - If writing code, use Markdown code blocks.
    - If the user asks about a specific file, refer to its content.
    - If web search is enabled, use it to find up-to-date information.
    """

    chat_history = []
    # Convert history format if needed (Gemini uses role: 'user'/'model')
    for msg in history:
        role = 'user' if msg['role'] == 'user' else 'model'
        chat_history.append({'role': role, 'parts': [msg['content']]})

    # Add system instruction as the first part of the context or just prepend it to the first message?
    # Gemini SDK supports system_instruction at model init, but we initialized globally.
    # We can start a chat with history.
    
    # Actually, let's prepend system instruction to the context or as a separate 'user' message that sets the stage if history is empty.
    # Or better, use the `system_instruction` param if we re-init model (expensive?).
    # Let's just create a new model instance for this turn if we want system prompts, or just include it in the prompt.
    
    # We'll use a fresh chat session for each request (stateless backend) passing full history.
    
    tools = 'google_search_retrieval' if web_search else None
    
    # Re-init model to inject system prompt cleanly
    session_model = genai.GenerativeModel(
        'gemini-2.0-flash-exp',
        system_instruction=system_instruction,
        tools=tools
    )
    
    chat = session_model.start_chat(history=chat_history)
    
    response = await chat.send_message_async(message)
    
    return {
        "text": response.text,
        "sources": [] # Extract if available in response.candidates[0].grounding_metadata
    }

def _format_files(files):
    if not files: return "No files referenced."
    return "\n".join([f"- {f['name']} ({f['type']}):\n```\n{f['content'][:2000]}...\n```" for f in files])

def _format_tasks(tasks):
    if not tasks: return "No tasks."
    return "\n".join([f"- [{t['status']}] {t['title']} (Priority: {t['priority']})" for t in tasks])
