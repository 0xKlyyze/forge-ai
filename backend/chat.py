from google import genai
from google.genai import types
import os
import logging
import traceback
from dotenv import load_dotenv

load_dotenv()

# Initialize client
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

# Model presets - user-friendly names mapped to actual model IDs
MODEL_PRESETS = {
    "powerful": {
        "id": "gemini-3-pro-preview",
        "name": "Powerful",
        "description": "Best reasoning & complex tasks",
        "icon": "brain"
    },
    "fast": {
        "id": "gemini-flash-latest",
        "name": "Fast",
        "description": "Balanced speed & quality",
        "icon": "zap"
    },
    "efficient": {
        "id": "gemini-flash-lite-latest",
        "name": "Efficient",
        "description": "Quick responses, lower cost",
        "icon": "leaf"
    }
}

def get_available_models():
    """Return the available model presets"""
    return MODEL_PRESETS

def get_model_id(preset: str) -> str:
    """Get the actual model ID from a preset name"""
    if preset in MODEL_PRESETS:
        return MODEL_PRESETS[preset]["id"]
    # Default to fast if invalid preset
    return MODEL_PRESETS["fast"]["id"]

async def generate_response(
    history: list,
    message: str,
    project_context: dict,
    web_search: bool = False,
    model_preset: str = "fast"
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

    # Convert history
    chat_history = []
    for msg in history:
        role = 'user' if msg['role'] == 'user' else 'model'
        chat_history.append(types.Content(role=role, parts=[types.Part.from_text(text=msg['content'])]))

    # Configure tools
    tools = []
    if web_search:
        tools.append(types.Tool(google_search=types.GoogleSearch()))

    # Get the actual model ID from preset
    model_id = get_model_id(model_preset)
    
    print(f"DEBUG: Using model: {model_id} (preset: {model_preset})")
    print(f"DEBUG: Tools config: {tools}")

    try:
        # Generate content
        response = await client.aio.models.generate_content(
            model=model_id,
            contents=chat_history + [types.Content(role='user', parts=[types.Part.from_text(text=message)])],
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                tools=tools
            )
        )
        
        return {
            "text": response.text,
            "sources": [],
            "model_used": model_id
        }

    except Exception as e:
        print("DEBUG: Detailed traceback:")
        traceback.print_exc()
        raise e

def _format_files(files):
    if not files: return "No files referenced."
    return "\n".join([f"- {f['name']} ({f['type']}):\n```\n{f['content'][:2000]}...\n```" for f in files])

def _format_tasks(tasks):
    if not tasks: return "No tasks."
    return "\n".join([f"- [{t['status']}] {t['title']} (Priority: {t['priority']})" for t in tasks])


async def edit_selection(
    selection: str,
    context_before: str,
    context_after: str,
    instruction: str,
    file_type: str = "javascript"
):
    """Edit a selected portion of code based on user instruction"""
    system_instruction = f"""
    You are an expert code editor. The user has selected a portion of code and wants you to modify it.
    
    RULES:
    - Return ONLY the edited code, no explanations or markdown formatting
    - Maintain the same indentation style as the original
    - Keep the code style consistent with the surrounding context
    - If the instruction is unclear, make reasonable assumptions
    - For the file type: {file_type}
    
    CONTEXT BEFORE SELECTION:
    ```
    {context_before[-1500:]}
    ```
    
    SELECTED TEXT TO EDIT:
    ```
    {selection}
    ```
    
    CONTEXT AFTER SELECTION:
    ```
    {context_after[:1500]}
    ```
    """
    
    try:
        response = await client.aio.models.generate_content(
            model="gemini-flash-latest",
            contents=[types.Content(role='user', parts=[types.Part.from_text(
                text=f"Edit the selected code according to this instruction: {instruction}\n\nReturn only the edited code, nothing else."
            )])],
            config=types.GenerateContentConfig(
                system_instruction=system_instruction
            )
        )
        
        # Clean up response - remove markdown code blocks if present
        result = response.text.strip()
        if result.startswith("```"):
            lines = result.split("\n")
            # Remove first and last lines (code block markers)
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            result = "\n".join(lines)
        
        return result
        
    except Exception as e:
        print(f"Edit selection error: {e}")
        traceback.print_exc()
        raise e
