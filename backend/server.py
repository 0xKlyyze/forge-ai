from fastapi import FastAPI, Depends, HTTPException, status, Body
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from database import db
from models import UserModel, UserResponse, ProjectModel, ProjectResponse, FileModel, FileResponse, TaskModel, TaskResponse, ChatSessionModel, ChatSessionResponse, ChatSessionListResponse
from auth import get_password_hash, verify_password, create_access_token, get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES
from datetime import timedelta, datetime
from typing import List
from chat import generate_response, get_available_models, edit_selection, assess_project_potential
from bson import ObjectId
import os

app = FastAPI()

origins = [
    "http://localhost:3000",
    "http://localhost:8000",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Forge API is running"}

# --- AUTH ---
@app.post("/api/auth/register", response_model=UserResponse)
async def register(user: UserModel):
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pw = get_password_hash(user.password_hash)
    new_user = user.dict(by_alias=True, exclude={"id"})
    new_user["password_hash"] = hashed_pw
    
    result = await db.users.insert_one(new_user)
    created_user = await db.users.find_one({"_id": result.inserted_id})
    
    return UserResponse(id=str(created_user["_id"]), email=created_user["email"])

@app.post("/api/auth/login")
async def login(form_data: dict = Body(...)):
    email = form_data.get("email")
    password = form_data.get("password")
    
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["email"], "id": str(user["_id"])}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "user": {"id": str(user["_id"]), "email": user["email"]}}

# --- PROJECTS ---
@app.post("/api/projects", response_model=ProjectResponse)
async def create_project(project: ProjectModel, current_user: dict = Depends(get_current_user)):
    new_project = project.dict(exclude={"id"})
    new_project["user_id"] = current_user["id"]
    new_project["created_at"] = datetime.now()
    new_project["last_edited"] = datetime.now()
    
    result = await db.projects.insert_one(new_project)
    
    # Auto-generate folder structure
    project_id = str(result.inserted_id)
    templates = [
        {"name": "Project-Overview.md", "category": "Docs", "type": "doc", "content": "# Project Overview\n\n## Core Concept\n\n## Target User\n\n## Key Features", "priority": 10},
        {"name": "Implementation-Plan.md", "category": "Docs", "type": "doc", "content": "# Implementation Plan\n\n## Phase 1\n\n## Phase 2", "priority": 9},
        {"name": "Technical-Stack.md", "category": "Docs", "type": "doc", "content": "# Technical Stack\n\n- Frontend:\n- Backend:\n- Database:", "priority": 8},
        {"name": "App-Structure.md", "category": "Docs", "type": "doc", "content": "# App Structure\n\n- /app\n  - /src", "priority": 7},
        {"name": "UI-Guidelines.md", "category": "Docs", "type": "doc", "content": "# UI Guidelines\n\n- Colors:\n- Typography:", "priority": 7}
    ]
    
    for tmpl in templates:
        file_doc = {
            "project_id": project_id,
            "name": tmpl["name"],
            "category": tmpl["category"],
            "type": tmpl["type"],
            "content": tmpl["content"],
            "priority": tmpl.get("priority", 5),
            "created_at": datetime.now(),
            "last_edited": datetime.now()
        }
        await db.files.insert_one(file_doc)
        
    created_project = await db.projects.find_one({"_id": result.inserted_id})
    return ProjectResponse(
        id=str(created_project["_id"]),
        name=created_project["name"],
        status=created_project.get("status", "planning"),
        tags=created_project.get("tags", []),
        links=created_project.get("links", []),
        icon=created_project.get("icon", ""),
        custom_categories=created_project.get("custom_categories", []),
        created_at=created_project["created_at"],
        last_edited=created_project["last_edited"]
    )

@app.get("/api/projects", response_model=List[ProjectResponse])
async def list_projects(current_user: dict = Depends(get_current_user)):
    projects = []
    cursor = db.projects.find({"user_id": current_user["id"]}).sort("last_edited", -1)
    async for project in cursor:
        projects.append(ProjectResponse(
            id=str(project["_id"]),
            name=project["name"],
            status=project.get("status", "planning"),
            tags=project.get("tags", []),
            links=project.get("links", []),
            icon=project.get("icon", ""),
            created_at=project["created_at"],
            last_edited=project["last_edited"]
        ))
    return projects

@app.post("/api/projects/{project_id}/assessment")
async def get_project_assessment(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"_id": ObjectId(project_id), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    cursor = db.files.find({"project_id": project_id})
    files = await cursor.to_list(length=100)
    
    files_data = [{"name": f["name"], "content": f.get("content", ""), "type": f["type"]} for f in files]
    
    assessment = await assess_project_potential(project["name"], files_data)
    return assessment
    
@app.get("/api/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"_id": ObjectId(project_id), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse(
        id=str(project["_id"]),
        name=project["name"],
        status=project.get("status", "planning"),
        tags=project.get("tags", []),
        links=project.get("links", []),
        icon=project.get("icon", ""),
        created_at=project["created_at"],
        last_edited=project["last_edited"]
    )

@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.projects.delete_one({"_id": ObjectId(project_id), "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
@app.put("/api/projects/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, updates: dict = Body(...), current_user: dict = Depends(get_current_user)):
    existing_project = await db.projects.find_one({"_id": ObjectId(project_id), "user_id": current_user["id"]})
    if not existing_project:
        raise HTTPException(status_code=404, detail="Project not found")
    print(f"DEBUG: update_project {project_id} received updates: {updates}")
    allowed = ["name", "status", "tags", "links", "icon", "custom_categories"]
    filtered_updates = {k: v for k, v in updates.items() if k in allowed}
    print(f"DEBUG: update_project {project_id} filtered updates: {filtered_updates}")
    
    if "custom_categories" in filtered_updates:
        print(f"DEBUG: Update contains custom_categories. Current DB state for project {project_id}:")
        current_proj = await db.projects.find_one({"_id": ObjectId(project_id)})
        print(f"DEBUG: Current custom_categories: {current_proj.get('custom_categories', [])}")

    filtered_updates["last_edited"] = datetime.now()
    
    result = await db.projects.update_one({"_id": ObjectId(project_id)}, {"$set": filtered_updates})
    print(f"DEBUG: update_one result: matched={result.matched_count}, modified={result.modified_count}")
    
    if "custom_categories" in filtered_updates:
        updated_proj = await db.projects.find_one({"_id": ObjectId(project_id)})
        print(f"DEBUG: POST-UPDATE custom_categories: {updated_proj.get('custom_categories', [])}")
    
    updated_project = await db.projects.find_one({"_id": ObjectId(project_id)})
    return ProjectResponse(
        id=str(updated_project["_id"]),
        name=updated_project["name"],
        status=updated_project.get("status", "planning"),
        tags=updated_project.get("tags", []),
        links=updated_project.get("links", []),
        icon=updated_project.get("icon", ""),
        custom_categories=updated_project.get("custom_categories", []),
        created_at=updated_project["created_at"],
        last_edited=updated_project["last_edited"]
    )

    # Delete associated files and tasks
    await db.files.delete_many({"project_id": project_id})
    await db.tasks.delete_many({"project_id": project_id})
    return {"detail": "Project deleted"}

# --- FILES ---
@app.get("/api/projects/{project_id}/files", response_model=List[FileResponse])
async def list_files(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"_id": ObjectId(project_id), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    files = []
    cursor = db.files.find({"project_id": project_id}).sort("priority", -1)
    async for f in cursor:
        files.append(FileResponse(
            id=str(f["_id"]),
            project_id=f["project_id"],
            name=f["name"],
            type=f["type"],
            category=f["category"],
            content=f.get("content", ""),
            priority=f.get("priority", 5),
            tags=f.get("tags", []),
            pinned=f.get("pinned", False),
            last_edited=f["last_edited"]
        ))
    return files

@app.post("/api/files", response_model=FileResponse)
async def create_file(file: FileModel, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"_id": ObjectId(file.project_id), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    new_file = file.dict(exclude={"id"})
    new_file["created_at"] = datetime.now()
    new_file["last_edited"] = datetime.now()
    
    result = await db.files.insert_one(new_file)
    await db.projects.update_one(
        {"_id": ObjectId(file.project_id)},
        {"$set": {"last_edited": datetime.now()}}
    )
    
    return FileResponse(
        id=str(result.inserted_id),
        project_id=new_file["project_id"],
        name=new_file["name"],
        type=new_file["type"],
        category=new_file["category"],
        content=new_file.get("content", ""),
        priority=new_file.get("priority", 5),
        pinned=new_file.get("pinned", False),
        last_edited=new_file["last_edited"]
    )

@app.put("/api/files/{file_id}", response_model=FileResponse)
async def update_file(file_id: str, file_update: dict = Body(...), current_user: dict = Depends(get_current_user)):
    existing_file = await db.files.find_one({"_id": ObjectId(file_id)})
    if not existing_file:
        raise HTTPException(status_code=404, detail="File not found")
        
    project = await db.projects.find_one({"_id": ObjectId(existing_file["project_id"]), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_data = {k: v for k, v in file_update.items() if k in ["name", "content", "category", "type", "priority", "pinned", "tags"]}
    update_data["last_edited"] = datetime.now()
    
    await db.files.update_one({"_id": ObjectId(file_id)}, {"$set": update_data})
    updated_file = await db.files.find_one({"_id": ObjectId(file_id)})
    
    await db.projects.update_one(
        {"_id": ObjectId(existing_file["project_id"])},
        {"$set": {"last_edited": datetime.now()}}
    )

    return FileResponse(
        id=str(updated_file["_id"]),
        project_id=updated_file["project_id"],
        name=updated_file["name"],
        type=updated_file["type"],
        category=updated_file["category"],
        content=updated_file.get("content", ""),
        priority=updated_file.get("priority", 5),
        tags=updated_file.get("tags", []),
        pinned=updated_file.get("pinned", False),
        last_edited=updated_file["last_edited"]
    )

@app.delete("/api/files/{file_id}")
async def delete_file(file_id: str, current_user: dict = Depends(get_current_user)):
    existing_file = await db.files.find_one({"_id": ObjectId(file_id)})
    if not existing_file:
        raise HTTPException(status_code=404, detail="File not found")
    project = await db.projects.find_one({"_id": ObjectId(existing_file["project_id"]), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.files.delete_one({"_id": ObjectId(file_id)})
    return {"detail": "File deleted"}

# --- TASKS ---
@app.get("/api/projects/{project_id}/tasks", response_model=List[TaskResponse])
async def list_tasks(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"_id": ObjectId(project_id), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    tasks = []
    cursor = db.tasks.find({"project_id": project_id})
    async for t in cursor:
        tasks.append(TaskResponse(
            id=str(t["_id"]),
            project_id=t["project_id"],
            title=t["title"],
            description=t.get("description", ""),
            status=t.get("status", "todo"),
            priority=t.get("priority", "medium"),
            quadrant=t.get("quadrant", "q2"),
            linked_files=t.get("linked_files", []),
            due_date=t.get("due_date"),
            created_at=t["created_at"]
        ))
    return tasks

@app.post("/api/tasks", response_model=TaskResponse)
async def create_task(task: TaskModel, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"_id": ObjectId(task.project_id), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    new_task = task.dict(exclude={"id"})
    new_task["created_at"] = datetime.now()
    
    result = await db.tasks.insert_one(new_task)
    return TaskResponse(
        id=str(result.inserted_id),
        project_id=new_task["project_id"],
        title=new_task["title"],
        description=new_task.get("description", ""),
        status=new_task.get("status", "todo"),
        priority=new_task.get("priority", "medium"),
        quadrant=new_task.get("quadrant", "q2"),
        importance=new_task.get("importance", "medium"),
        linked_files=new_task.get("linked_files", []),
        due_date=new_task.get("due_date"),
        created_at=new_task["created_at"]
    )

@app.put("/api/tasks/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, task_update: dict = Body(...), current_user: dict = Depends(get_current_user)):
    existing_task = await db.tasks.find_one({"_id": ObjectId(task_id)})
    if not existing_task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    project = await db.projects.find_one({"_id": ObjectId(existing_task["project_id"]), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Allowed fields to update
    allowed_keys = ["title", "description", "status", "priority", "quadrant", "linked_files", "due_date", "importance"]
    update_data = {k: v for k, v in task_update.items() if k in allowed_keys}
    
    await db.tasks.update_one({"_id": ObjectId(task_id)}, {"$set": update_data})
    updated_task = await db.tasks.find_one({"_id": ObjectId(task_id)})
    
    return TaskResponse(
        id=str(updated_task["_id"]),
        project_id=updated_task["project_id"],
        title=updated_task["title"],
        description=updated_task.get("description", ""),
        status=updated_task.get("status", "todo"),
        priority=updated_task.get("priority", "medium"),
        quadrant=updated_task.get("quadrant", "q2"),
        importance=updated_task.get("importance", "medium"),
        linked_files=updated_task.get("linked_files", []),
        due_date=updated_task.get("due_date"),
        created_at=updated_task["created_at"]
    )

@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str, current_user: dict = Depends(get_current_user)):
    existing_task = await db.tasks.find_one({"_id": ObjectId(task_id)})
    if not existing_task:
        raise HTTPException(status_code=404, detail="Task not found")
    project = await db.projects.find_one({"_id": ObjectId(existing_task["project_id"]), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    await db.tasks.delete_one({"_id": ObjectId(task_id)})
    return {"detail": "Task deleted"}

# --- CHAT ---
class ChatRequest(BaseModel):
    message: str
    history: List[dict] = [] # [{'role': 'user', 'content': 'hi'}]
    project_id: str
    context_mode: str = "selective" # 'all' or 'selective'
    referenced_files: List[str] = [] # List of file IDs
    web_search: bool = False

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    # Verify project access
    project = await db.projects.find_one({"_id": ObjectId(request.project_id), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Gather Context
    context_files = []
    context_tasks = []
    
    if request.context_mode == 'all':
        cursor_f = db.files.find({"project_id": request.project_id})
        async for f in cursor_f:
            context_files.append(f)
        cursor_t = db.tasks.find({"project_id": request.project_id})
        async for t in cursor_t:
            context_tasks.append(t)
    elif request.referenced_files:
        # Fetch specific files
        object_ids = [ObjectId(fid) for fid in request.referenced_files if ObjectId.is_valid(fid)]
        cursor_f = db.files.find({"_id": {"$in": object_ids}})
        async for f in cursor_f:
            context_files.append(f)
            
    # Always include basic project info
    project_context = {
        "name": project["name"],
        "status": project.get("status", "planning"),
        "files": context_files,
        "tasks": context_tasks
    }
    
    try:
        response = await generate_response(
            history=request.history,
            message=request.message,
            project_context=project_context,
            web_search=request.web_search
        )
        return response
    except Exception as e:
        print(f"Gemini Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- DASHBOARD ---

class DashboardResponse(BaseModel):
    projects: List[dict]
    recent_conversations: List[dict]
    priority_tasks: List[dict]

@app.get("/api/dashboard", response_model=DashboardResponse)
async def get_dashboard_data(current_user: dict = Depends(get_current_user)):
    """Get aggregated data for dashboard widgets"""
    
    # 1. Get projects with file/task counts
    projects = []
    cursor = db.projects.find({"user_id": current_user["id"]}).sort("last_edited", -1)
    async for project in cursor:
        project_id = str(project["_id"])
        
        # Count files and tasks
        file_count = await db.files.count_documents({"project_id": project_id})
        task_count = await db.tasks.count_documents({"project_id": project_id})
        completed_tasks = await db.tasks.count_documents({"project_id": project_id, "status": "done"})
        
        projects.append({
            "id": project_id,
            "name": project["name"],
            "status": project.get("status", "planning"),
            "icon": project.get("icon", ""),
            "file_count": file_count,
            "task_count": task_count,
            "completed_tasks": completed_tasks,
            "last_edited": project["last_edited"].isoformat() if project.get("last_edited") else None,
            "created_at": project["created_at"].isoformat() if project.get("created_at") else None
        })
    
    # 2. Get recent conversations across all projects
    recent_conversations = []
    project_ids = [p["id"] for p in projects]
    
    if project_ids:
        cursor = db.chat_sessions.find({"project_id": {"$in": project_ids}}).sort("updated_at", -1).limit(5)
        async for session in cursor:
            # Get project name
            project_name = next((p["name"] for p in projects if p["id"] == session["project_id"]), "Unknown")
            
            recent_conversations.append({
                "id": str(session["_id"]),
                "project_id": session["project_id"],
                "project_name": project_name,
                "title": session.get("title", "New Chat"),
                "message_count": len(session.get("messages", [])),
                "updated_at": session["updated_at"].isoformat() if session.get("updated_at") else None
            })
    
    # 3. Get priority tasks (Q1 - urgent & important, or high priority not done)
    priority_tasks = []
    if project_ids:
        cursor = db.tasks.find({
            "project_id": {"$in": project_ids},
            "status": {"$ne": "done"},
            "$or": [
                {"quadrant": "q1"},
                {"priority": "high", "importance": "high"}
            ]
        }).sort("created_at", -1).limit(10)
        
        async for task in cursor:
            project_name = next((p["name"] for p in projects if p["id"] == task["project_id"]), "Unknown")
            
            priority_tasks.append({
                "id": str(task["_id"]),
                "project_id": task["project_id"],
                "project_name": project_name,
                "title": task["title"],
                "priority": task.get("priority", "medium"),
                "importance": task.get("importance", "medium"),
                "quadrant": task.get("quadrant", "q2"),
                "status": task.get("status", "todo")
            })
    
    return DashboardResponse(
        projects=projects,
        recent_conversations=recent_conversations,
        priority_tasks=priority_tasks
    )

@app.get("/api/projects/{project_id}/dashboard")
async def get_project_dashboard(project_id: str, current_user: dict = Depends(get_current_user)):
    """Get dashboard data for a specific project (for Project Home widgets)"""
    
    # Verify project ownership
    project = await db.projects.find_one({"_id": ObjectId(project_id), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get priority tasks (Q1 - urgent & important, not done)
    priority_tasks = []
    cursor = db.tasks.find({
        "project_id": project_id,
        "status": {"$ne": "done"},
        "$or": [
            {"quadrant": "q1"},
            {"priority": "high", "importance": "high"}
        ]
    }).sort("created_at", -1).limit(5)
    
    async for task in cursor:
        priority_tasks.append({
            "id": str(task["_id"]),
            "title": task["title"],
            "priority": task.get("priority", "medium"),
            "importance": task.get("importance", "medium"),
            "quadrant": task.get("quadrant", "q2"),
            "status": task.get("status", "todo")
        })
    
    # Get recent chat sessions for this project
    recent_chats = []
    cursor = db.chat_sessions.find({"project_id": project_id}).sort("updated_at", -1).limit(5)
    
    async for session in cursor:
        recent_chats.append({
            "id": str(session["_id"]),
            "title": session.get("title", "New Chat"),
            "message_count": len(session.get("messages", [])),
            "updated_at": session["updated_at"].isoformat() if session.get("updated_at") else None
        })
    
    return {
        "priority_tasks": priority_tasks,
        "recent_chats": recent_chats
    }

# --- AI MODELS ---

@app.get("/api/models")
async def get_models():
    """Get available AI model presets"""
    return get_available_models()

# --- CHAT SESSIONS ---

@app.get("/api/projects/{project_id}/chat-sessions", response_model=List[ChatSessionListResponse])
async def list_chat_sessions(project_id: str, current_user: dict = Depends(get_current_user)):
    """List all chat sessions for a project"""
    project = await db.projects.find_one({"_id": ObjectId(project_id), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    sessions = []
    # Sort by pinned first, then by updated_at
    cursor = db.chat_sessions.find({"project_id": project_id}).sort([("pinned", -1), ("updated_at", -1)])
    async for s in cursor:
        sessions.append(ChatSessionListResponse(
            id=str(s["_id"]),
            project_id=s["project_id"],
            title=s.get("title", "New Chat"),
            message_count=len(s.get("messages", [])),
            pinned=s.get("pinned", False),
            created_at=s["created_at"],
            updated_at=s["updated_at"]
        ))
    return sessions

@app.post("/api/projects/{project_id}/chat-sessions", response_model=ChatSessionResponse)
async def create_chat_session(project_id: str, current_user: dict = Depends(get_current_user)):
    """Create a new chat session"""
    project = await db.projects.find_one({"_id": ObjectId(project_id), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    new_session = {
        "project_id": project_id,
        "title": "New Chat",
        "messages": [
            {"role": "model", "content": "I'm Forge AI. I can help you with architecture, code, or planning. Type '@' to reference specific files.", "timestamp": datetime.now().isoformat()}
        ],
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
    
    result = await db.chat_sessions.insert_one(new_session)
    new_session["_id"] = result.inserted_id
    
    return ChatSessionResponse(
        id=str(result.inserted_id),
        project_id=project_id,
        title=new_session["title"],
        messages=new_session["messages"],
        created_at=new_session["created_at"],
        updated_at=new_session["updated_at"]
    )

@app.get("/api/chat-sessions/{session_id}", response_model=ChatSessionResponse)
async def get_chat_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Get a chat session with all messages"""
    session = await db.chat_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    # Verify user owns the project
    project = await db.projects.find_one({"_id": ObjectId(session["project_id"]), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return ChatSessionResponse(
        id=str(session["_id"]),
        project_id=session["project_id"],
        title=session.get("title", "New Chat"),
        messages=session.get("messages", []),
        created_at=session["created_at"],
        updated_at=session["updated_at"]
    )

class ChatMessageRequest(BaseModel):
    message: str
    context_mode: str = "selective"
    referenced_files: List[str] = []
    web_search: bool = False
    model_preset: str = "fast"  # powerful, fast, or efficient

@app.post("/api/chat-sessions/{session_id}/messages")
async def add_message_to_session(session_id: str, request: ChatMessageRequest, current_user: dict = Depends(get_current_user)):
    """Add a message to a session and get AI response"""
    session = await db.chat_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    project = await db.projects.find_one({"_id": ObjectId(session["project_id"]), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Add user message
    user_msg = {"role": "user", "content": request.message, "timestamp": datetime.now().isoformat()}
    
    # Gather context
    context_files = []
    context_tasks = []
    
    if request.context_mode == 'all':
        cursor_f = db.files.find({"project_id": session["project_id"]})
        async for f in cursor_f:
            context_files.append(f)
        cursor_t = db.tasks.find({"project_id": session["project_id"]})
        async for t in cursor_t:
            context_tasks.append(t)
    elif request.referenced_files:
        object_ids = [ObjectId(fid) for fid in request.referenced_files if ObjectId.is_valid(fid)]
        cursor_f = db.files.find({"_id": {"$in": object_ids}})
        async for f in cursor_f:
            context_files.append(f)
    
    project_context = {
        "name": project["name"],
        "status": project.get("status", "planning"),
        "files": context_files,
        "tasks": context_tasks
    }
    
    # Get existing messages for history
    history = session.get("messages", [])
    
    try:
        response = await generate_response(
            history=history,
            message=request.message,
            project_context=project_context,
            web_search=request.web_search,
            model_preset=request.model_preset
        )
        
        ai_msg = {"role": "model", "content": response["text"], "timestamp": datetime.now().isoformat()}
        
        # Update session with new messages
        await db.chat_sessions.update_one(
            {"_id": ObjectId(session_id)},
            {
                "$push": {"messages": {"$each": [user_msg, ai_msg]}},
                "$set": {"updated_at": datetime.now()}
            }
        )
        
        # Auto-generate title from first user message if still "New Chat"
        if session.get("title") == "New Chat" and len(history) <= 1:
            # Use first ~50 chars of user message as title
            auto_title = request.message[:50] + ("..." if len(request.message) > 50 else "")
            await db.chat_sessions.update_one(
                {"_id": ObjectId(session_id)},
                {"$set": {"title": auto_title}}
            )
        
        return {"user_message": user_msg, "ai_message": ai_msg}
        
    except Exception as e:
        print(f"Gemini Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/chat-sessions/{session_id}")
async def update_chat_session(session_id: str, updates: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Update chat session (e.g., title, pinned)"""
    session = await db.chat_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    project = await db.projects.find_one({"_id": ObjectId(session["project_id"]), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    allowed = ["title", "pinned"]
    filtered_updates = {k: v for k, v in updates.items() if k in allowed}
    filtered_updates["updated_at"] = datetime.now()
    
    await db.chat_sessions.update_one({"_id": ObjectId(session_id)}, {"$set": filtered_updates})
    return {"detail": "Session updated"}

@app.delete("/api/chat-sessions/{session_id}")
async def delete_chat_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a chat session"""
    session = await db.chat_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    project = await db.projects.find_one({"_id": ObjectId(session["project_id"]), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    await db.chat_sessions.delete_one({"_id": ObjectId(session_id)})
    return {"detail": "Session deleted"}

# --- AI EDIT SELECTION ---
class EditSelectionRequest(BaseModel):
    selection: str
    context_before: str
    context_after: str
    instruction: str
    file_type: str = "javascript"

@app.post("/api/ai/edit-selection")
async def ai_edit_selection(request: EditSelectionRequest, current_user: dict = Depends(get_current_user)):
    """Edit a selected portion of code using AI"""
    try:
        edited_content = await edit_selection(
            selection=request.selection,
            context_before=request.context_before,
            context_after=request.context_after,
            instruction=request.instruction,
            file_type=request.file_type
        )
        return {"edited_content": edited_content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
