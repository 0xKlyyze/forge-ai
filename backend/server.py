from fastapi import FastAPI, Depends, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
from database import db
from models import UserModel, UserResponse, ProjectModel, ProjectResponse, FileModel, FileResponse, TaskModel, TaskResponse
from auth import get_password_hash, verify_password, create_access_token, get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES
from datetime import timedelta, datetime
from typing import List
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
            created_at=project["created_at"],
            last_edited=project["last_edited"]
        ))
    return projects

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
        
    allowed = ["name", "status", "tags", "links", "icon"]
    filtered_updates = {k: v for k, v in updates.items() if k in allowed}
    filtered_updates["last_edited"] = datetime.now()
    
    await db.projects.update_one({"_id": ObjectId(project_id)}, {"$set": filtered_updates})
    
    updated_project = await db.projects.find_one({"_id": ObjectId(project_id)})
    return ProjectResponse(
        id=str(updated_project["_id"]),
        name=updated_project["name"],
        status=updated_project.get("status", "planning"),
        tags=updated_project.get("tags", []),
        links=updated_project.get("links", []),
        icon=updated_project.get("icon", ""),
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
    
    update_data = {k: v for k, v in file_update.items() if k in ["name", "content", "category", "type", "priority", "pinned"]}
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
