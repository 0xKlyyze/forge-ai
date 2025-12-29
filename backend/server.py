from fastapi import FastAPI, Depends, HTTPException, status, Body
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from database import db, get_db, close_mongo_connection
from contextlib import asynccontextmanager
from models import UserModel, UserResponse, ProjectModel, ProjectResponse, FileModel, FileResponse, TaskModel, TaskResponse, ChatSessionModel, ChatSessionResponse, ChatSessionListResponse
from auth import get_password_hash, verify_password, create_access_token, create_refresh_token, verify_refresh_token, get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES
from datetime import timedelta, datetime
from typing import List
from chat import generate_response, get_available_models, edit_selection, assess_project_potential, format_content_with_lines, apply_insert, apply_replace
from bson import ObjectId
import os

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await get_db()
    yield
    # Shutdown
    await close_mongo_connection()

app = FastAPI(lifespan=lifespan)

origins = [
    "http://localhost:3000",
    "http://localhost:8000",
    "https://*.netlify.app",
    "https://*.run.app",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
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
    refresh_token = create_refresh_token(
        data={"sub": user["email"], "id": str(user["_id"])}
    )
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {"id": str(user["_id"]), "email": user["email"]}
    }

@app.post("/api/auth/refresh")
async def refresh_token(body: dict = Body(...)):
    """Refresh access token using a valid refresh token."""
    refresh_token_str = body.get("refresh_token")
    
    if not refresh_token_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token required"
        )
    
    # Verify the refresh token
    user_data = verify_refresh_token(refresh_token_str)
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    
    # Generate new access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    new_access_token = create_access_token(
        data={"sub": user_data["email"], "id": user_data["id"]},
        expires_delta=access_token_expires
    )
    
    # Rotate refresh token (generate a new one for added security)
    new_refresh_token = create_refresh_token(
        data={"sub": user_data["email"], "id": user_data["id"]}
    )
    
    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }

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
        difficulty=new_task.get("difficulty", "medium"),
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
    allowed_keys = ["title", "description", "status", "priority", "quadrant", "linked_files", "due_date", "importance", "difficulty"]
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
        difficulty=updated_task.get("difficulty", "medium"),
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
    referenced_tasks: List[str] = [] # List of task IDs
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
    elif request.referenced_files or request.referenced_tasks:
        # Fetch specific files
        if request.referenced_files:
            object_ids = [ObjectId(fid) for fid in request.referenced_files if ObjectId.is_valid(fid)]
            cursor_f = db.files.find({"_id": {"$in": object_ids}})
            async for f in cursor_f:
                context_files.append(f)
        
        # Fetch specific tasks
        if request.referenced_tasks:
            task_ids = [ObjectId(tid) for tid in request.referenced_tasks if ObjectId.is_valid(tid)]
            cursor_t = db.tasks.find({"_id": {"$in": task_ids}})
            async for t in cursor_t:
                context_tasks.append(t)
            
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
    referenced_tasks: List[str] = []
    attached_images: List[dict] = []  # Images with name, mimeType, and base64 data
    web_search: bool = False
    model_preset: str = "fast"  # powerful, fast, or efficient
    agentic_mode: bool = True  # Enable AI tool-calling by default

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
    
    # Load files based on context mode:
    # - 'all' (All Files toggle ON): Load all project files
    # - 'selective' (default): Only load explicitly referenced files
    context_files = []
    context_tasks = []
    
    if request.context_mode == 'all':
        # Load ALL files and tasks when "All Files" toggle is enabled
        cursor_f = db.files.find({"project_id": session["project_id"]})
        async for f in cursor_f:
            context_files.append(f)
        cursor_t = db.tasks.find({"project_id": session["project_id"]})
        async for t in cursor_t:
            context_tasks.append(t)
        print(f"DEBUG: All Files mode - loaded {len(context_files)} files, {len(context_tasks)} tasks")
    else:
        # Selective mode: Only load explicitly referenced files/tasks
        if request.referenced_files:
            print(f"DEBUG: Selective mode - loading {len(request.referenced_files)} referenced files")
            object_ids = [ObjectId(fid) for fid in request.referenced_files if ObjectId.is_valid(fid)]
            if object_ids:
                cursor_f = db.files.find({"_id": {"$in": object_ids}})
                async for f in cursor_f:
                    context_files.append(f)
            print(f"DEBUG: Loaded files: {[f['name'] for f in context_files]}")
        
        if request.referenced_tasks:
            print(f"DEBUG: Selective mode - loading {len(request.referenced_tasks)} referenced tasks")
            task_ids = [ObjectId(tid) for tid in request.referenced_tasks if ObjectId.is_valid(tid)]
            if task_ids:
                cursor_t = db.tasks.find({"_id": {"$in": task_ids}})
                async for t in cursor_t:
                    context_tasks.append(t)
        
        if not request.referenced_files and not request.referenced_tasks:
            print(f"DEBUG: No files/tasks referenced")
    
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
            attached_images=request.attached_images,
            web_search=request.web_search,
            model_preset=request.model_preset,
            agentic_mode=request.agentic_mode
        )
        
        # Build AI message with tool calls if present
        ai_msg = {
            "role": "model", 
            "content": response["text"], 
            "references": response.get("references", []),
            "tool_calls": response.get("tool_calls", []),
            "timestamp": datetime.now().isoformat()
        }
        
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

@app.post("/api/chat-sessions/{session_id}/messages/raw")
async def add_chat_message(session_id: str, message: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Manually add a raw message to a session (e.g. for tool outputs)"""
    session = await db.chat_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    project = await db.projects.find_one({"_id": ObjectId(session["project_id"]), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Validate message structure minimally
    if "role" not in message or "content" not in message:
         raise HTTPException(status_code=400, detail="Message must have role and content")
    
    message["timestamp"] = datetime.now().isoformat()
    
    await db.chat_sessions.update_one(
        {"_id": ObjectId(session_id)},
        {
            "$push": {"messages": message},
            "$set": {"updated_at": datetime.now()}
        }
    )
    
    return {"success": True, "message": message}

# ═══════════════════════════════════════════════════════════════════════════════
# AI TOOL EXECUTION - Execute tool calls from agentic AI
# ═══════════════════════════════════════════════════════════════════════════════

class ExecuteToolRequest(BaseModel):
    tool_name: str
    arguments: dict
    project_id: str

@app.post("/api/ai/execute-tool")
async def execute_ai_tool(request: ExecuteToolRequest, current_user: dict = Depends(get_current_user)):
    """Execute a tool call from the AI (create/modify documents and tasks)"""
    
    # Verify project ownership
    project = await db.projects.find_one({"_id": ObjectId(request.project_id), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    tool_name = request.tool_name
    args = request.arguments
    
    try:
        if tool_name == "create_document":
            # Create a new document
            new_file = {
                "project_id": request.project_id,
                "name": args.get("name", "Untitled.md"),
                "category": args.get("category", "Docs"),
                "type": args.get("doc_type", "doc"),
                "content": args.get("content", ""),
                "priority": 5,
                "tags": [],
                "pinned": False,
                "created_at": datetime.now(),
                "last_edited": datetime.now()
            }
            
            result = await db.files.insert_one(new_file)
            
            # Update project last_edited
            await db.projects.update_one(
                {"_id": ObjectId(request.project_id)},
                {"$set": {"last_edited": datetime.now()}}
            )
            
            return {
                "success": True,
                "tool_name": tool_name,
                "result": {
                    "file_id": str(result.inserted_id),
                    "name": new_file["name"],
                    "category": new_file["category"],
                    "type": new_file["type"],
                    "content": new_file["content"]
                },
                "message": f"Created document: {new_file['name']}"
            }
        
        elif tool_name == "modify_document":
            # Modify an existing document
            file_id = args.get("file_id")
            if not file_id:
                raise HTTPException(status_code=400, detail="file_id is required")
            
            existing_file = await db.files.find_one({"_id": ObjectId(file_id)})
            if not existing_file:
                raise HTTPException(status_code=404, detail="File not found")
            
            # Verify file belongs to project
            if existing_file["project_id"] != request.project_id:
                raise HTTPException(status_code=403, detail="File does not belong to this project")
            
            update_data = {
                "content": args.get("new_content", existing_file.get("content", "")),
                "last_edited": datetime.now()
            }
            
            await db.files.update_one({"_id": ObjectId(file_id)}, {"$set": update_data})
            
            await db.projects.update_one(
                {"_id": ObjectId(request.project_id)},
                {"$set": {"last_edited": datetime.now()}}
            )
            
            return {
                "success": True,
                "tool_name": tool_name,
                "result": {
                    "file_id": file_id,
                    "name": args.get("file_name", existing_file["name"]),
                    "content": update_data["content"]
                },
                "message": f"Updated document: {args.get('file_name', existing_file['name'])}"
            }
        
        elif tool_name == "create_tasks":
            # Create multiple tasks
            tasks_data = args.get("tasks", [])
            if not tasks_data:
                raise HTTPException(status_code=400, detail="tasks array is required")
            
            created_tasks = []
            for task_item in tasks_data:
                new_task = {
                    "project_id": request.project_id,
                    "title": task_item.get("title", "Untitled Task"),
                    "description": task_item.get("description", ""),
                    "status": "todo",
                    "priority": task_item.get("priority", "medium"),
                    "importance": task_item.get("importance", "medium"),
                    "difficulty": "medium",
                    "quadrant": "q2",  # Default to important but not urgent
                    "linked_files": [],
                    "due_date": None,
                    "created_at": datetime.now()
                }
                
                # Auto-assign quadrant based on priority/importance
                if task_item.get("priority") == "high" and task_item.get("importance") == "high":
                    new_task["quadrant"] = "q1"
                elif task_item.get("importance") == "high":
                    new_task["quadrant"] = "q2"
                elif task_item.get("priority") == "high":
                    new_task["quadrant"] = "q3"
                else:
                    new_task["quadrant"] = "q4"
                
                result = await db.tasks.insert_one(new_task)
                created_tasks.append({
                    "id": str(result.inserted_id),
                    "title": new_task["title"],
                    "priority": new_task["priority"],
                    "importance": new_task["importance"]
                })
            
            return {
                "success": True,
                "tool_name": tool_name,
                "result": {
                    "tasks": created_tasks,
                    "count": len(created_tasks)
                },
                "message": f"Created {len(created_tasks)} task(s)"
            }
        
        elif tool_name == "modify_task":
            # Modify an existing task
            task_id = args.get("task_id")
            if not task_id:
                raise HTTPException(status_code=400, detail="task_id is required")
            
            existing_task = await db.tasks.find_one({"_id": ObjectId(task_id)})
            if not existing_task:
                raise HTTPException(status_code=404, detail="Task not found")
            
            # Verify task belongs to project
            if existing_task["project_id"] != request.project_id:
                raise HTTPException(status_code=403, detail="Task does not belong to this project")
            
            updates = args.get("updates", {})
            allowed_keys = ["title", "description", "status", "priority", "importance", "difficulty", "quadrant"]
            update_data = {k: v for k, v in updates.items() if k in allowed_keys}
            
            if update_data:
                await db.tasks.update_one({"_id": ObjectId(task_id)}, {"$set": update_data})
            
            return {
                "success": True,
                "tool_name": tool_name,
                "result": {
                    "task_id": task_id,
                    "title": args.get("task_title", existing_task["title"]),
                    "updates": update_data
                },
                "message": f"Updated task: {args.get('task_title', existing_task['title'])}"
            }
        
        elif tool_name == "create_mockup":
            # Create a new UI mockup file
            new_file = {
                "project_id": request.project_id,
                "name": args.get("name", "Untitled.jsx"),
                "category": "Mockups",  # Mockups have their own category
                "type": "mockup",  # Type is 'mockup' for live preview
                "content": args.get("content", ""),
                "priority": 5,
                "tags": ["ai-generated"],
                "pinned": False,
                "created_at": datetime.now(),
                "last_edited": datetime.now()
            }
            
            result = await db.files.insert_one(new_file)
            
            # Update project last_edited
            await db.projects.update_one(
                {"_id": ObjectId(request.project_id)},
                {"$set": {"last_edited": datetime.now()}}
            )
            
            return {
                "success": True,
                "tool_name": tool_name,
                "result": {
                    "file_id": str(result.inserted_id),
                    "name": new_file["name"],
                    "category": new_file["category"],
                    "type": new_file["type"],
                    "content": new_file["content"]
                },
                "message": f"Created UI mockup: {new_file['name']}"
            }
        
        else:
            raise HTTPException(status_code=400, detail=f"Unknown tool: {tool_name}")
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Tool execution error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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


# ═══════════════════════════════════════════════════════════════════════════════
# AI DOCUMENT EDITING - Multi-step document editing with diff preview
# ═══════════════════════════════════════════════════════════════════════════════

from google import genai
from google.genai import types
import json

# Initialize genai client for document editing
genai_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

class EditDocumentRequest(BaseModel):
    tool_name: str  # 'rewrite_document/mockup', 'insert_in_document/mockup', 'replace_in_document/mockup'
    file_id: str
    file_name: str
    instructions: str
    project_id: str

@app.post("/api/ai/edit-document")
async def edit_document(request: EditDocumentRequest, current_user: dict = Depends(get_current_user)):
    """
    Multi-step document editing endpoint.
    Returns both original and modified content for diff preview.
    """
    
    # Verify project ownership
    project = await db.projects.find_one({
        "_id": ObjectId(request.project_id), 
        "user_id": current_user["id"]
    })
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get the file
    file = await db.files.find_one({"_id": ObjectId(request.file_id)})
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Verify file belongs to project
    if file["project_id"] != request.project_id:
        raise HTTPException(status_code=403, detail="File does not belong to this project")
    
    original_content = file.get("content", "")
    tool_name = request.tool_name
    
    # Determine if this is a mockup edit (uses JSX-specific prompts)
    is_mockup = tool_name.endswith("_mockup") or file.get("type") == "mockup"
    file_type_desc = "React component (JSX/TSX)" if is_mockup else "document"
    content_type = "JSX/TSX code" if is_mockup else "content"
    
    # Normalize tool name (mockup tools use same logic as document tools)
    base_tool_name = tool_name.replace("_mockup", "_document")
    
    try:
        if base_tool_name == "rewrite_document":
            # ═══════════════════════════════════════════════════════════════
            # REWRITE: Single AI call to completely rewrite the document/mockup
            # ═══════════════════════════════════════════════════════════════
            
            if is_mockup:
                prompt = f"""You are redesigning a React UI mockup based on user instructions.

CURRENT MOCKUP ({request.file_name}):
{original_content}

USER INSTRUCTIONS:
{request.instructions}

Please completely redesign the React component according to the instructions above.
Return ONLY the new JSX/TSX code, no explanations or markdown code blocks.
Ensure the component is complete with all necessary imports and uses Tailwind CSS for styling.
"""
            else:
                prompt = f"""You are rewriting a document based on user instructions.

CURRENT DOCUMENT ({request.file_name}):
{original_content}

USER INSTRUCTIONS:
{request.instructions}

Please rewrite the entire document according to the instructions above.
Return ONLY the new document content, no explanations or markdown code blocks.
"""
            
            response = genai_client.models.generate_content(
                model="gemini-flash-latest",
                contents=prompt
            )
            
            modified_content = response.text.strip()
            edit_summary = f"{'Mockup' if is_mockup else 'Document'} completely redesigned based on: {request.instructions[:100]}..."
            
        elif base_tool_name == "insert_in_document":
            # ═══════════════════════════════════════════════════════════════
            # INSERT: Two-step AI call - find location, then generate content
            # ═══════════════════════════════════════════════════════════════
            
            # Step 1: Determine insertion point
            line_indexed_content = format_content_with_lines(original_content)
            
            step1_prompt = f"""Analyze this {file_type_desc} and determine where to insert new {content_type}.

{'MOCKUP' if is_mockup else 'DOCUMENT'} WITH LINE NUMBERS:
{line_indexed_content}

USER REQUEST:
{request.instructions}

Based on the user's request, determine the best line number to insert new {content_type} AFTER.
Respond with ONLY a JSON object in this exact format:
{{"insert_after_line": <number>, "reason": "<brief explanation>"}}

Example response: {{"insert_after_line": 15, "reason": "Inserting after the header component"}}
"""
            
            step1_response = genai_client.models.generate_content(
                model="gemini-flash-latest",
                contents=step1_prompt
            )
            
            # Parse the insertion point
            try:
                step1_text = step1_response.text.strip()
                # Clean up potential markdown code blocks
                if step1_text.startswith("```"):
                    step1_text = step1_text.split("\n", 1)[1].rsplit("```", 1)[0]
                step1_result = json.loads(step1_text)
                insert_line = step1_result.get("insert_after_line", len(original_content.split('\n')))
            except:
                # Default to end if parsing fails
                insert_line = len(original_content.split('\n'))
            
            # Step 2: Generate content to insert
            if is_mockup:
                step2_prompt = f"""Generate JSX/TSX code to insert into a React component mockup.

MOCKUP ({request.file_name}):
{original_content}

INSERTION POINT: After line {insert_line}

USER REQUEST:
{request.instructions}

Generate ONLY the new JSX/TSX code to be inserted. Do not include the existing component code.
The code should be valid React/JSX and flow naturally with the existing component.
Do not include any explanations or markdown code blocks, just the raw JSX to insert.
"""
            else:
                step2_prompt = f"""Generate content to insert into a document.

DOCUMENT ({request.file_name}):
{original_content}

INSERTION POINT: After line {insert_line}

USER REQUEST:
{request.instructions}

Generate ONLY the new content to be inserted. Do not include the existing document content.
The content should flow naturally with the existing document.
Do not include any explanations or markdown code blocks, just the raw content to insert.
"""
            
            step2_response = genai_client.models.generate_content(
                model="gemini-flash-latest",
                contents=step2_prompt
            )
            
            insert_content = step2_response.text.strip()
            modified_content = apply_insert(original_content, insert_line, insert_content)
            edit_summary = f"Inserted {'JSX elements' if is_mockup else 'content'} after line {insert_line}"
            
        elif base_tool_name == "replace_in_document":
            # ═══════════════════════════════════════════════════════════════
            # REPLACE: Two-step AI call - find range, then generate replacement
            # ═══════════════════════════════════════════════════════════════
            
            # Step 1: Determine replacement range
            line_indexed_content = format_content_with_lines(original_content)
            
            step1_prompt = f"""Analyze this {file_type_desc} and determine which lines should be replaced.

{'MOCKUP' if is_mockup else 'DOCUMENT'} WITH LINE NUMBERS:
{line_indexed_content}

USER REQUEST:
{request.instructions}

Based on the user's request, determine the line range to replace.
Respond with ONLY a JSON object in this exact format:
{{"start_line": <number>, "end_line": <number>, "reason": "<brief explanation>"}}

Example response: {{"start_line": 10, "end_line": 25, "reason": "Replacing the {'button component' if is_mockup else 'introduction section'}"}}
"""
            
            step1_response = genai_client.models.generate_content(
                model="gemini-flash-latest",
                contents=step1_prompt
            )
            
            # Parse the replacement range
            try:
                step1_text = step1_response.text.strip()
                if step1_text.startswith("```"):
                    step1_text = step1_text.split("\n", 1)[1].rsplit("```", 1)[0]
                step1_result = json.loads(step1_text)
                start_line = step1_result.get("start_line", 1)
                end_line = step1_result.get("end_line", len(original_content.split('\n')))
            except:
                # Default to replacing the whole document if parsing fails
                start_line = 1
                end_line = len(original_content.split('\n'))
            
            # Extract the content being replaced for context
            lines = original_content.split('\n')
            content_being_replaced = '\n'.join(lines[max(0,start_line-1):min(len(lines),end_line)])
            
            # Step 2: Generate replacement content
            if is_mockup:
                step2_prompt = f"""Generate replacement JSX/TSX code for a specific section of a React component.

MOCKUP ({request.file_name}):
{original_content}

SECTION TO REPLACE (lines {start_line}-{end_line}):
{content_being_replaced}

USER REQUEST:
{request.instructions}

Generate ONLY the replacement JSX/TSX code for lines {start_line} to {end_line}.
The code should be valid React/JSX and fit naturally into the component structure.
Do not include any explanations or markdown code blocks, just the raw replacement code.
"""
            else:
                step2_prompt = f"""Generate replacement content for a specific section of a document.

DOCUMENT ({request.file_name}):
{original_content}

SECTION TO REPLACE (lines {start_line}-{end_line}):
{content_being_replaced}

USER REQUEST:
{request.instructions}

Generate ONLY the replacement content for lines {start_line} to {end_line}.
The content should fit naturally into the document structure.
Do not include any explanations or markdown code blocks, just the raw replacement content.
"""
            
            step2_response = genai_client.models.generate_content(
                model="gemini-flash-latest",
                contents=step2_prompt
            )
            
            replacement_content = step2_response.text.strip()
            modified_content = apply_replace(original_content, start_line, end_line, replacement_content)
            edit_summary = f"Replaced {'component code on' if is_mockup else ''} lines {start_line}-{end_line}"
            
        else:
            raise HTTPException(status_code=400, detail=f"Unknown edit tool: {tool_name}")
        
        return {
            "success": True,
            "tool_name": tool_name,
            "result": {
                "file_id": request.file_id,
                "file_name": request.file_name,
                "original_content": original_content,
                "modified_content": modified_content,
                "edit_type": tool_name.replace("_document", "").replace("_mockup", "").replace("_in", ""),
                "edit_summary": edit_summary
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Document edit error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

