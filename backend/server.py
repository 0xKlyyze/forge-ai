from fastapi import FastAPI, Depends, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
from database import db
from models import UserModel, UserResponse, ProjectModel, ProjectResponse, FileModel, FileResponse
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
        {"name": "Project-Overview.md", "category": "Docs", "type": "doc", "content": "# Project Overview\n\n## Core Concept\n\n## Target User\n\n## Key Features"},
        {"name": "Implementation-Plan.md", "category": "Docs", "type": "doc", "content": "# Implementation Plan\n\n## Phase 1\n\n## Phase 2"},
        {"name": "Technical-Stack.md", "category": "Docs", "type": "doc", "content": "# Technical Stack\n\n- Frontend:\n- Backend:\n- Database:"},
        {"name": "App-Structure.md", "category": "Docs", "type": "doc", "content": "# App Structure\n\n- /app\n  - /src"},
        {"name": "UI-Guidelines.md", "category": "Docs", "type": "doc", "content": "# UI Guidelines\n\n- Colors:\n- Typography:"}
    ]
    
    for tmpl in templates:
        file_doc = {
            "project_id": project_id,
            "name": tmpl["name"],
            "category": tmpl["category"],
            "type": tmpl["type"],
            "content": tmpl["content"],
            "created_at": datetime.now(),
            "last_edited": datetime.now()
        }
        await db.files.insert_one(file_doc)
        
    created_project = await db.projects.find_one({"_id": result.inserted_id})
    return ProjectResponse(
        id=str(created_project["_id"]),
        name=created_project["name"],
        status=created_project["status"],
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
        created_at=project["created_at"],
        last_edited=project["last_edited"]
    )

@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.projects.delete_one({"_id": ObjectId(project_id), "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    # Delete associated files
    await db.files.delete_many({"project_id": project_id})
    return {"detail": "Project deleted"}

# --- FILES ---
@app.get("/api/projects/{project_id}/files", response_model=List[FileResponse])
async def list_files(project_id: str, current_user: dict = Depends(get_current_user)):
    # verify project ownership
    project = await db.projects.find_one({"_id": ObjectId(project_id), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    files = []
    cursor = db.files.find({"project_id": project_id})
    async for f in cursor:
        files.append(FileResponse(
            id=str(f["_id"]),
            project_id=f["project_id"],
            name=f["name"],
            type=f["type"],
            category=f["category"],
            content=f.get("content", ""),
            last_edited=f["last_edited"]
        ))
    return files

@app.post("/api/files", response_model=FileResponse)
async def create_file(file: FileModel, current_user: dict = Depends(get_current_user)):
    # verify project ownership
    project = await db.projects.find_one({"_id": ObjectId(file.project_id), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    new_file = file.dict(exclude={"id"})
    new_file["created_at"] = datetime.now()
    new_file["last_edited"] = datetime.now()
    
    result = await db.files.insert_one(new_file)
    
    # Update project last_edited
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
        last_edited=new_file["last_edited"]
    )

@app.put("/api/files/{file_id}", response_model=FileResponse)
async def update_file(file_id: str, file_update: dict = Body(...), current_user: dict = Depends(get_current_user)):
    # Check if file exists first to get project_id
    existing_file = await db.files.find_one({"_id": ObjectId(file_id)})
    if not existing_file:
        raise HTTPException(status_code=404, detail="File not found")
        
    # verify project ownership
    project = await db.projects.find_one({"_id": ObjectId(existing_file["project_id"]), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_data = {k: v for k, v in file_update.items() if k in ["name", "content", "category", "type"]}
    update_data["last_edited"] = datetime.now()
    
    await db.files.update_one({"_id": ObjectId(file_id)}, {"$set": update_data})
    
    updated_file = await db.files.find_one({"_id": ObjectId(file_id)})
    
    # Update project last_edited
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
        last_edited=updated_file["last_edited"]
    )

@app.delete("/api/files/{file_id}")
async def delete_file(file_id: str, current_user: dict = Depends(get_current_user)):
     # Check if file exists first to get project_id
    existing_file = await db.files.find_one({"_id": ObjectId(file_id)})
    if not existing_file:
        raise HTTPException(status_code=404, detail="File not found")
        
    # verify project ownership
    project = await db.projects.find_one({"_id": ObjectId(existing_file["project_id"]), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    await db.files.delete_one({"_id": ObjectId(file_id)})
    return {"detail": "File deleted"}
