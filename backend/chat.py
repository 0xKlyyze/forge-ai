from google import genai
from google.genai import types
import os
import logging
import traceback
import base64
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

from pydantic import BaseModel, Field
from typing import List, Optional

# Pydantic models for structured AI response
class Reference(BaseModel):
    type: str = Field(description="Either 'File' or 'Task'")
    name: str = Field(description="The exact name of the file or task title")

# ═══════════════════════════════════════════════════════════════════════════════
# TOOL CALL MODELS - For Agentic AI Features
# ═══════════════════════════════════════════════════════════════════════════════

class CreateDocumentArgs(BaseModel):
    name: str = Field(description="Document name with extension (e.g., 'API-Design.md')")
    category: str = Field(description="Document category: 'Docs', 'Code', 'Notes', 'Assets'", default="Docs")
    doc_type: str = Field(description="Document type: 'doc', 'code', 'note'", default="doc")
    content: str = Field(description="Full content of the document in Markdown format")

# ═══════════════════════════════════════════════════════════════════════════════
# DOCUMENT EDITING MODELS - For multi-step editing operations
# ═══════════════════════════════════════════════════════════════════════════════

class RewriteDocumentArgs(BaseModel):
    file_id: str = Field(description="The ID of the file to rewrite")
    file_name: str = Field(description="The name of the file being rewritten (for display)")
    instructions: str = Field(description="Instructions on how to rewrite the document")

class InsertInDocumentArgs(BaseModel):
    file_id: str = Field(description="The ID of the file to insert into")
    file_name: str = Field(description="The name of the file being modified (for display)")
    instructions: str = Field(description="What to insert and context about where")

class ReplaceInDocumentArgs(BaseModel):
    file_id: str = Field(description="The ID of the file to modify")
    file_name: str = Field(description="The name of the file being modified (for display)")
    instructions: str = Field(description="What section to replace and what to replace it with")

class DocumentEditResult(BaseModel):
    """Result of a document edit operation - includes both original and modified for diff view"""
    file_id: str
    file_name: str
    original_content: str
    modified_content: str
    edit_type: str  # 'rewrite', 'insert', 'replace'
    edit_summary: str  # Human-readable summary of what was changed

# ═══════════════════════════════════════════════════════════════════════════════
# UI MOCKUP MODELS - For JSX/TSX UI component mockups
# ═══════════════════════════════════════════════════════════════════════════════

class CreateMockupArgs(BaseModel):
    name: str = Field(description="Mockup name with extension (e.g., 'LoginForm.jsx', 'Dashboard.tsx')")
    content: str = Field(description="Full JSX/TSX code for the UI mockup component. Must be a valid React component.")

class RewriteMockupArgs(BaseModel):
    file_id: str = Field(description="The ID of the mockup file to rewrite")
    file_name: str = Field(description="The name of the mockup being rewritten (for display)")
    instructions: str = Field(description="Instructions on how to redesign/rewrite the mockup")

class InsertInMockupArgs(BaseModel):
    file_id: str = Field(description="The ID of the mockup file to insert into")
    file_name: str = Field(description="The name of the mockup being modified (for display)")
    instructions: str = Field(description="What JSX elements/components to add and where")

class ReplaceInMockupArgs(BaseModel):
    file_id: str = Field(description="The ID of the mockup file to modify")
    file_name: str = Field(description="The name of the mockup being modified (for display)")
    instructions: str = Field(description="Which component/section to replace and what to replace it with")

class MockupEditResult(BaseModel):
    """Result of a mockup edit operation - includes both original and modified for diff view"""
    file_id: str
    file_name: str
    original_content: str
    modified_content: str
    edit_type: str  # 'rewrite', 'insert', 'replace'
    edit_summary: str  # Human-readable summary of what was changed

# Legacy modify_document (kept for backward compatibility)
class ModifyDocumentArgs(BaseModel):
    file_id: str = Field(description="The ID of the file to modify")
    file_name: str = Field(description="The name of the file being modified (for display)")
    new_content: str = Field(description="The complete new content for the document")

class TaskItem(BaseModel):
    title: str = Field(description="Task title")
    description: str = Field(description="Detailed task description", default="")
    priority: str = Field(description="Priority: 'low', 'medium', 'high'", default="medium")
    importance: str = Field(description="Importance: 'low', 'medium', 'high'", default="medium")

class CreateTasksArgs(BaseModel):
    tasks: List[TaskItem] = Field(description="List of tasks to create")

class ModifyTaskArgs(BaseModel):
    task_id: str = Field(description="The ID of the task to modify")
    task_title: str = Field(description="The title of the task being modified (for display)")
    updates: dict = Field(description="Fields to update: title, description, status, priority, importance")

class ToolCall(BaseModel):
    tool_name: str = Field(description="Name of the tool: 'create_document', 'rewrite_document', 'insert_in_document', 'replace_in_document', 'create_mockup', 'rewrite_mockup', 'insert_in_mockup', 'replace_in_mockup', 'create_tasks', 'modify_task'")
    arguments: dict = Field(description="Arguments for the tool call")
    status: str = Field(description="Status: 'pending', 'executing', 'success', 'error'", default="pending")

class AgenticChatResponse(BaseModel):
    message: str = Field(description="The AI response text with Markdown formatting")
    references: List[Reference] = Field(description="List of files or tasks referenced in the response", default=[])
    tool_calls: List[ToolCall] = Field(description="List of tool calls the AI wants to execute", default=[])

# Legacy response for backward compatibility
class ChatResponse(BaseModel):
    message: str = Field(description="The AI response text with Markdown formatting")
    references: List[Reference] = Field(description="List of files or tasks referenced in the response", default=[])


# ═══════════════════════════════════════════════════════════════════════════════
# DOCUMENT EDITING HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def format_content_with_lines(content: str) -> str:
    """Format document content with line numbers for AI analysis.
    Used by insert_in_document and replace_in_document to help AI identify locations.
    """
    lines = content.split('\n')
    return '\n'.join(f'{i+1}: {line}' for i, line in enumerate(lines))


def apply_insert(original_content: str, insert_line: int, new_content: str) -> str:
    """Insert new content after a specific line number."""
    lines = original_content.split('\n')
    if insert_line <= 0:
        # Insert at beginning
        return new_content + '\n' + original_content
    elif insert_line >= len(lines):
        # Insert at end
        return original_content + '\n' + new_content
    else:
        # Insert after the specified line
        before = '\n'.join(lines[:insert_line])
        after = '\n'.join(lines[insert_line:])
        return before + '\n' + new_content + '\n' + after


def apply_replace(original_content: str, start_line: int, end_line: int, new_content: str) -> str:
    """Replace lines in range [start_line, end_line] (1-indexed) with new content."""
    lines = original_content.split('\n')
    # Convert to 0-indexed
    start_idx = max(0, start_line - 1)
    end_idx = min(len(lines), end_line)
    
    before = '\n'.join(lines[:start_idx])
    after = '\n'.join(lines[end_idx:])
    
    parts = []
    if before:
        parts.append(before)
    parts.append(new_content)
    if after:
        parts.append(after)
    
    return '\n'.join(parts)


# ═══════════════════════════════════════════════════════════════════════════════
# GEMINI FUNCTION DECLARATIONS - For Agentic Tools
# ═══════════════════════════════════════════════════════════════════════════════

def get_agentic_tools():
    """Define the function declarations for agentic AI tools"""
    return types.Tool(function_declarations=[
        types.FunctionDeclaration(
            name="create_document",
            description="Create a new document in the project. Use this when the user asks you to create, write, draft, or generate a new document, file, or spec.",
            parameters={
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Document name with extension (e.g., 'API-Design.md', 'feature-spec.md')"
                    },
                    "category": {
                        "type": "string",
                        "description": "Document category",
                        "enum": ["Docs", "Code", "Notes", "Assets"]
                    },
                    "doc_type": {
                        "type": "string",
                        "description": "Document type",
                        "enum": ["doc", "code", "note"]
                    },
                    "content": {
                        "type": "string",
                        "description": "Full content of the document in Markdown format. Be comprehensive and well-structured."
                    }
                },
                "required": ["name", "content"]
            }
        ),
        # ═══════════════════════════════════════════════════════════════════════
        # DOCUMENT EDITING TOOLS - Three specialized tools for different edit types
        # ═══════════════════════════════════════════════════════════════════════
        types.FunctionDeclaration(
            name="rewrite_document",
            description="Completely rewrite an existing document. Use this when the user asks to rewrite, redo, completely change, or make major changes to a document's entire content.",
            parameters={
                "type": "object",
                "properties": {
                    "file_id": {
                        "type": "string",
                        "description": "The ID of the file to rewrite (from the context)"
                    },
                    "file_name": {
                        "type": "string",
                        "description": "The name of the file being rewritten (for display)"
                    },
                    "instructions": {
                        "type": "string",
                        "description": "Detailed instructions on how to rewrite the document, what to change, what style/tone to use"
                    }
                },
                "required": ["file_id", "file_name", "instructions"]
            }
        ),
        types.FunctionDeclaration(
            name="insert_in_document",
            description="Insert new content at a specific location in an existing document. Use this when the user asks to add, insert, append, or include new content/sections in a document without changing existing content.",
            parameters={
                "type": "object",
                "properties": {
                    "file_id": {
                        "type": "string",
                        "description": "The ID of the file to insert into (from the context)"
                    },
                    "file_name": {
                        "type": "string",
                        "description": "The name of the file being modified (for display)"
                    },
                    "instructions": {
                        "type": "string",
                        "description": "What content to insert and where (e.g., 'Add a FAQ section after the introduction', 'Insert troubleshooting steps at the end')"
                    }
                },
                "required": ["file_id", "file_name", "instructions"]
            }
        ),
        types.FunctionDeclaration(
            name="replace_in_document",
            description="Replace a specific section/part of an existing document. Use this when the user asks to replace, update, or change a specific part while keeping the rest unchanged.",
            parameters={
                "type": "object",
                "properties": {
                    "file_id": {
                        "type": "string",
                        "description": "The ID of the file to modify (from the context)"
                    },
                    "file_name": {
                        "type": "string",
                        "description": "The name of the file being modified (for display)"
                    },
                    "instructions": {
                        "type": "string",
                        "description": "Which section/part to replace and what to replace it with (e.g., 'Replace the introduction with a shorter version', 'Update the API endpoints section')"
                    }
                },
                "required": ["file_id", "file_name", "instructions"]
            }
        ),
        types.FunctionDeclaration(
            name="create_tasks",
            description="Create one or more tasks in the project. Use this when the user asks you to create, add, or generate tasks, todos, or action items.",
            parameters={
                "type": "object",
                "properties": {
                    "tasks": {
                        "type": "array",
                        "description": "List of tasks to create",
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": {
                                    "type": "string",
                                    "description": "Task title - clear and actionable"
                                },
                                "description": {
                                    "type": "string",
                                    "description": "Detailed task description"
                                },
                                "priority": {
                                    "type": "string",
                                    "enum": ["low", "medium", "high"],
                                    "description": "Task priority"
                                },
                                "importance": {
                                    "type": "string",
                                    "enum": ["low", "medium", "high"],
                                    "description": "Task importance"
                                }
                                ## TODO : Add difficulty property as well
                            },
                            "required": ["title"]
                        }
                    }
                },
                "required": ["tasks"]
            }
        ),
        types.FunctionDeclaration(
            name="modify_task",
            description="Modify an existing task in the project. Use this when the user asks you to update, change, or edit a task's details, status, or priority.",
            parameters={
                "type": "object",
                "properties": {
                    "task_id": {
                        "type": "string",
                        "description": "The ID of the task to modify (from the context)"
                    },
                    "task_title": {
                        "type": "string",
                        "description": "The current title of the task being modified (for display)"
                    },
                    "updates": {
                        "type": "object",
                        "description": "Fields to update",
                        "properties": {
                            "title": {"type": "string"},
                            "description": {"type": "string"},
                            "status": {"type": "string", "enum": ["todo", "in-progress", "done"]},
                            "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                            "importance": {"type": "string", "enum": ["low", "medium", "high"]}
                            ## TODO : Add difficulty property as well
                        }
                    }
                },
                "required": ["task_id", "task_title", "updates"]
            }
        ),
        # ═══════════════════════════════════════════════════════════════════════
        # UI MOCKUP TOOLS - For creating and editing JSX/TSX UI components
        # ═══════════════════════════════════════════════════════════════════════
        types.FunctionDeclaration(
            name="create_mockup",
            description="Create a new UI mockup component (JSX/TSX). Use this when the user asks you to create, design, build, or make a new UI component, screen, page, form, or interface mockup.",
            parameters={
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Mockup file name with extension (e.g., 'LoginForm.jsx', 'Dashboard.tsx', 'Navbar.jsx')"
                    },
                    "content": {
                        "type": "string",
                        "description": "Full JSX/TSX code for the UI mockup. Must be a complete, valid React component that can be rendered. Use Tailwind CSS for styling. Include all necessary imports."
                    }
                },
                "required": ["name", "content"]
            }
        ),
        types.FunctionDeclaration(
            name="rewrite_mockup",
            description="Completely redesign/rewrite an existing UI mockup. Use this when the user asks to redesign, redo, completely change, or make major changes to a mockup's entire layout or style.",
            parameters={
                "type": "object",
                "properties": {
                    "file_id": {
                        "type": "string",
                        "description": "The ID of the mockup file to rewrite (from the context)"
                    },
                    "file_name": {
                        "type": "string",
                        "description": "The name of the mockup being rewritten (for display)"
                    },
                    "instructions": {
                        "type": "string",
                        "description": "Detailed instructions on how to redesign the mockup, what style/layout changes to make"
                    }
                },
                "required": ["file_id", "file_name", "instructions"]
            }
        ),
        types.FunctionDeclaration(
            name="insert_in_mockup",
            description="Add new UI elements/components to an existing mockup. Use this when the user asks to add, insert, or include new buttons, sections, forms, or components in a mockup.",
            parameters={
                "type": "object",
                "properties": {
                    "file_id": {
                        "type": "string",
                        "description": "The ID of the mockup file to insert into (from the context)"
                    },
                    "file_name": {
                        "type": "string",
                        "description": "The name of the mockup being modified (for display)"
                    },
                    "instructions": {
                        "type": "string",
                        "description": "What UI elements to add and where (e.g., 'Add a forgot password link below the login button', 'Insert a sidebar navigation')"
                    }
                },
                "required": ["file_id", "file_name", "instructions"]
            }
        ),
        types.FunctionDeclaration(
            name="replace_in_mockup",
            description="Replace specific UI components/sections in an existing mockup. Use this when the user asks to change, update, or replace specific parts of the UI while keeping the rest.",
            parameters={
                "type": "object",
                "properties": {
                    "file_id": {
                        "type": "string",
                        "description": "The ID of the mockup file to modify (from the context)"
                    },
                    "file_name": {
                        "type": "string",
                        "description": "The name of the mockup being modified (for display)"
                    },
                    "instructions": {
                        "type": "string",
                        "description": "Which component/section to replace and what to replace it with (e.g., 'Replace the header with a sticky navbar', 'Update the form to use cards')"
                    }
                },
                "required": ["file_id", "file_name", "instructions"]
            }
        )
    ])


async def generate_agentic_response(
    history: list,
    message: str,
    project_context: dict,
    attached_images: list = None,
    web_search: bool = False,
    model_preset: str = "fast"
):
    """Generate an AI response with agentic tool-calling capabilities"""
    ## TODO : Architecture change for better AI output : first API call to a fast Gemini model ONLY to determine whether a tool call is needed, and which ones are needed, then another API call, with a different prompt depending on the output of the first call (for eg. if no agentic tool call is needed, absolutely no needed to list all the available tools to the AI), this will also reduce the perceived waiting time for the user as it we'll be able to update the UI more quickly with the tool that'll be used if any
    
    # Build file context with IDs for modification
    files_with_ids = project_context.get('files', [])
    tasks_with_ids = project_context.get('tasks', [])
    
    system_instruction = f"""
    You are Forge AI, an expert software architect and coding assistant with AGENTIC capabilities.
    You are helping a developer with their project: {project_context['name']}.
    Status: {project_context['status']}
    
    CONTEXT:
    The user has shared the following project context. Use it to answer questions.
    
    FILES (with IDs for modification):
    {_format_files_with_ids(files_with_ids)}
    
    TASKS (with IDs for modification):
    {_format_tasks_with_ids(tasks_with_ids)}
    
    ═══════════════════════════════════════════════════════════════════════════════
    CRITICAL: WHEN TO USE TOOLS vs WHEN TO JUST RESPOND
    ═══════════════════════════════════════════════════════════════════════════════
    
    **DEFAULT BEHAVIOR**: Just respond with helpful text. Do NOT use tools unless explicitly asked.
    
    ❌ DO NOT USE TOOLS for:
    - Questions like "is this good?", "what do you think?", "explain this", "review this"
    - Asking for opinions, feedback, analysis, or explanations
    - General conversation or clarification questions
    - Any question that doesn't explicitly request creating or modifying content
    
    ✅ ONLY USE TOOLS when the user EXPLICITLY asks you to:
    - "add X to the document" → insert_in_document
    - "create a new file/document" → create_document
    - "rewrite this document" → rewrite_document
    - "replace/update this section" → replace_in_document
    - "create a UI mockup/component" → create_mockup
    - "redesign this mockup" → rewrite_mockup
    - "add a button/section to the mockup" → insert_in_mockup
    - "replace this UI element" → replace_in_mockup
    - "create tasks for X" → create_tasks
    - "mark task as done" → modify_task
    
    The keyword is EXPLICIT - the user must clearly ask you to CREATE, ADD, MODIFY, or UPDATE something.
    If there's ANY doubt, just respond with text - don't use a tool.
    
    ═══════════════════════════════════════════════════════════════════════════════
    
    AVAILABLE TOOLS (only when explicitly requested):
    
    DOCUMENT TOOLS:
    - create_document: Create a new document/file in the project
    - rewrite_document: Completely rewrite an existing document
    - insert_in_document: Add new content at a specific location
    - replace_in_document: Replace a specific section
    
    UI MOCKUP TOOLS (for React/JSX components):
    - create_mockup: Create a new UI component mockup (LoginForm.jsx, Dashboard.tsx, etc.)
    - rewrite_mockup: Completely redesign an existing mockup
    - insert_in_mockup: Add new UI elements (buttons, forms, sections)
    - replace_in_mockup: Replace specific UI components
    
    TASK TOOLS:
    - create_tasks: Create one or more tasks
    - modify_task: Update an existing task
    
    INSTRUCTIONS:
    - When using tools, also provide a brief message explaining what you're doing.
    - Be comprehensive when creating document content.
    - For UI mockups: Create complete, valid React components using Tailwind CSS. Include all imports.
    - For questions, advice, feedback, or explanations - just respond naturally WITHOUT tools.
    """

    # Convert history - skip tool messages (they have dict content for frontend rehydration)
    chat_history = []
    for msg in history:
        # Skip tool messages - these are persisted for frontend rehydration only
        if msg.get('role') == 'tool':
            continue
        # Skip messages with non-string content (e.g. tool outputs stored as dicts)
        if not isinstance(msg.get('content'), str):
            continue
        role = 'user' if msg['role'] == 'user' else 'model'
        chat_history.append(types.Content(role=role, parts=[types.Part.from_text(text=msg['content'])]))

    # Configure tools - include both agentic tools and optionally web search
    tools = [get_agentic_tools()]
    if web_search:
        tools.append(types.Tool(google_search=types.GoogleSearch()))

    model_id = get_model_id(model_preset)
    print(f"DEBUG: Using model: {model_id} (preset: {model_preset}) with agentic tools")

    try:
        # Build user message parts (text + optional images)
        user_parts = [types.Part.from_text(text=message)]
        
        # Add images if provided
        if attached_images:
            print(f"DEBUG: Processing {len(attached_images)} attached images")
            for img in attached_images:
                try:
                    image_data = base64.b64decode(img['data'])
                    user_parts.append(types.Part.from_bytes(
                        data=image_data,
                        mime_type=img.get('mimeType', 'image/png')
                    ))
                    print(f"DEBUG: Added image: {img.get('name', 'unknown')} ({img.get('mimeType', 'image/png')})")
                except Exception as img_err:
                    print(f"DEBUG: Failed to process image: {img_err}")
        
        response = await client.aio.models.generate_content(
            model=model_id,
            contents=chat_history + [types.Content(role='user', parts=user_parts)],
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                tools=tools
            )
        )
        
        # Debug: Log the user message
        print(f"DEBUG: User message: {message[:200]}...")
        print(f"DEBUG: History length: {len(chat_history)} messages")
        
        # Process the response - check for function calls
        tool_calls = []
        text_parts = []
        
        print(f"DEBUG: Response candidates count: {len(response.candidates)}")
        
        for candidate in response.candidates:
            print(f"DEBUG: Candidate parts count: {len(candidate.content.parts)}")
            for i, part in enumerate(candidate.content.parts):
                print(f"DEBUG: Part {i} type: function_call={hasattr(part, 'function_call') and part.function_call is not None}, text={hasattr(part, 'text') and part.text is not None}")
                if hasattr(part, 'function_call') and part.function_call:
                    fc = part.function_call
                    tool_calls.append({
                        "tool_name": fc.name,
                        "arguments": dict(fc.args) if fc.args else {},
                        "status": "pending"
                    })
                    print(f"DEBUG: ⚠️ TOOL CALL DETECTED: {fc.name}")
                    print(f"DEBUG:    Arguments: {str(fc.args)[:200]}...")
                elif hasattr(part, 'text') and part.text:
                    text_parts.append(part.text)
                    print(f"DEBUG: Text part: {part.text[:100]}...")
        
        combined_text = " ".join(text_parts) if text_parts else ""
        print(f"DEBUG: Final - Tool calls: {len(tool_calls)}, Text length: {len(combined_text)}")
        
        # If there are tool calls but no text, generate a helpful message
        if tool_calls and not combined_text:
            tool_names = [tc["tool_name"] for tc in tool_calls]
            if "create_document" in tool_names:
                combined_text = "I'll create that document for you. You can review and edit it in the panel on the right."
            elif "create_mockup" in tool_names:
                combined_text = "I'll create that UI mockup for you. You can preview and edit it in the panel on the right."
            elif any(t in tool_names for t in ["rewrite_mockup", "insert_in_mockup", "replace_in_mockup"]):
                combined_text = "I'll update that mockup for you. You can preview the changes in the panel."
            elif "modify_document" in tool_names:
                combined_text = "I'll update that document for you. You can review the changes in the editor panel."
            elif "create_tasks" in tool_names:
                combined_text = "I'll create those tasks for you. Review them below before confirming."
            elif "modify_task" in tool_names:
                combined_text = "I'll update that task for you."
            else:
                combined_text = "I'm working on that for you..."
        
        return {
            "text": combined_text,
            "references": [],  # Tool-calling mode doesn't use structured JSON
            "tool_calls": tool_calls,
            "sources": [],
            "model_used": model_id
        }

    except Exception as e:
        print("DEBUG: Detailed traceback:")
        traceback.print_exc()
        raise e


async def generate_response(
    history: list,
    message: str,
    project_context: dict,
    attached_images: list = None,
    web_search: bool = False,
    model_preset: str = "fast",
    agentic_mode: bool = False
):
    """Generate AI response - optionally with agentic tool-calling"""
    
    # Route to agentic mode if enabled
    if agentic_mode:
        return await generate_agentic_response(
            history, message, project_context, attached_images, web_search, model_preset
        )
        
    ## TODO : Enhance system instructions prompt engineering for better output
    system_instruction = f"""
    You are Forge AI, an expert software architect and coding assistant.
    You are helping a developer with their project: {project_context['name']}.
    Status: {project_context['status']}
    
    CONTEXT:
    The user has shared the following project context. Use it to answer questions.
    
    FILES:
    {_format_files(project_context.get('files', []))}
    
    TASKS:
    {_format_tasks(project_context.get('tasks', []))}
    
    INSTRUCTIONS:
    - Be concise, technical, and helpful.
    - ONLY use code blocks or backticks for actual programming code snippets.
    - NEVER use backticks for regular words like "todo", "done", status names, or any non-code text.
    - When mentioning files or tasks, just write their names naturally in plain text.
    - DO NOT create markdown links. DO NOT use [name](url) syntax.
    - For each file or task you mention, add it to the references array with the EXACT title.
    """

    # Convert history - skip tool messages (they have dict content for frontend rehydration)
    chat_history = []
    for msg in history:
        # Skip tool messages - these are persisted for frontend rehydration only
        if msg.get('role') == 'tool':
            continue
        # Skip messages with non-string content (e.g. tool outputs stored as dicts)
        if not isinstance(msg.get('content'), str):
            continue
        role = 'user' if msg['role'] == 'user' else 'model'
        chat_history.append(types.Content(role=role, parts=[types.Part.from_text(text=msg['content'])]))

    # Configure tools
    tools = []
    if web_search:
        tools.append(types.Tool(google_search=types.GoogleSearch()))

    # Get the actual model ID from preset
    model_id = get_model_id(model_preset)
    
    print(f"DEBUG: Using model: {model_id} (preset: {model_preset})")

    try:
        # Generate content with mandatory JSON schema
        response = await client.aio.models.generate_content(
            model=model_id,
            contents=chat_history + [types.Content(role='user', parts=[types.Part.from_text(text=message)])],
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                tools=tools if tools else None,
                response_mime_type="application/json",
                response_json_schema=ChatResponse.model_json_schema()
            )
        )
        
        # Parse JSON response using Pydantic for validation
        import json
        try:
            parsed = ChatResponse.model_validate_json(response.text)
            return {
                "text": parsed.message,
                "references": [ref.model_dump() for ref in parsed.references],
                "tool_calls": [],  # Non-agentic mode has no tool calls
                "sources": [],
                "model_used": model_id
            }
        except Exception as parse_error:
            print(f"DEBUG: JSON parsing failed: {parse_error}, raw: {response.text[:500]}")
            # Fallback: try basic JSON parsing
            try:
                raw = json.loads(response.text)
                return {
                    "text": raw.get("message", response.text),
                    "references": raw.get("references", []),
                    "tool_calls": [],
                    "sources": [],
                    "model_used": model_id
                }
            except:
                return {
                    "text": response.text,
                    "references": [],
                    "tool_calls": [],
                    "sources": [],
                    "model_used": model_id
                }

    except Exception as e:
        print("DEBUG: Detailed traceback:")
        traceback.print_exc()
        raise e


def _format_files_with_ids(files):
    """Format files with IDs and content for agentic mode"""
    if not files: 
        return "No files in project."
    lines = []
    for f in files:
        file_id = str(f.get('_id', f.get('id', 'unknown')))
        content = f.get('content', '')
        # Truncate long content to avoid token limits (3000 chars per file)
        truncated = content[:3000] + ('...' if len(content) > 3000 else '')
        lines.append(f"""
--- FILE: {f['name']} ---
ID: {file_id}
Type: {f['type']} | Category: {f.get('category', 'Docs')}
CONTENT:
{truncated}
""")
    return "\n".join(lines)


def _format_tasks_with_ids(tasks):
    """Format tasks with IDs for agentic mode"""
    if not tasks: 
        return "No tasks in project."
    lines = []
    for t in tasks:
        task_id = str(t.get('_id', t.get('id', 'unknown')))
        lines.append(f'- ID: {task_id} | Title: "{t["title"]}" | Status: {t.get("status", "todo")} | Priority: {t.get("priority", "medium")}')
    return "\n".join(lines)


def _format_files(files):
    if not files: return "No files referenced."
    return "\n".join([f"- {f['name']} ({f['type']}):\n```\n{f['content'][:2000]}...\n```" for f in files])

def _format_tasks(tasks):
    if not tasks: return "No tasks."
    # Format: Title: "exact title" | Status: status | Priority: priority
    return "\n".join([f'- Title: "{t["title"]}" | Status: {t["status"]} | Priority: {t["priority"]}' for t in tasks])


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

async def assess_project_potential(project_name: str, files: list) -> dict:
    """
    Generate a brutally honest assessment of the project based on its files.
    Returns a JSON breakdown of ratings and feedback.
    """
    system_instruction = """
    You are a brutally honest, no-nonsense VC and Tech Lead. 
    You are assessing a technical project based on its initial documentation (Overview, Tech Stack, Plan).
    
    YOUR GOAL: Provide a "brutally honest" assessment. Do not hold back.
    
    OUTPUT FORMAT: Return a valid JSON object ONLY, with the following structure:
    {
        "ratings": {
            "innovation": 0-10,
            "feasibility": 0-10,
            "market_potential": 0-10
        },
        "unclear_areas": ["list", "of", "vague", "points"],
        "missing_components": ["list", "of", "technical", "gaps"],
        "summary": "A short, punchy paragraph (max 100 words). Be direct. If it's generic, say it. If it's genius, say it."
    }
    """
    
    file_context = _format_files(files)
    
    prompt = f"""
    Assess the project "{project_name}".
    
    FILES SUBMITTED:
    {file_context}
    
    Generate the assessment JSON.
    """
    
    try:
        response = await client.aio.models.generate_content(
            model="gemini-flash-latest",
            contents=[types.Content(role='user', parts=[types.Part.from_text(text=prompt)])],
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json"
            )
        )
        
        import json
        return json.loads(response.text)
        
    except Exception as e:
        print(f"Assessment error: {e}")
        traceback.print_exc()
        # Return a fallback in case of error
        return {
            "ratings": {"innovation": 0, "feasibility": 0, "market_potential": 0},
            "unclear_areas": ["Could not generate assessment due to error."],
            "missing_components": [],
            "summary": "Assessment generation failed. Please try again."
        }
