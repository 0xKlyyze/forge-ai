
# --- SHARING & COLLABORATION ---

@app.post("/api/projects/{project_id}/share")
async def share_project(project_id: str, permissions: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Generate a public read-only share link"""
    project = await db.projects.find_one({"_id": ObjectId(project_id), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    token = secrets.token_urlsafe(16)
    share_link = {
        "project_id": project_id,
        "created_by": current_user["id"],
        "token": token,
        "type": "view",
        "permissions": permissions, # { 'allow_files': ['id1', 'id2'], 'allow_pages': ['home', 'tasks'] }
        "status": "active",
        "created_at": datetime.now(),
        "views": 0
    }
    
    await db.share_links.insert_one(share_link)
    return {"token": token, "url": f"/s/{token}"}

@app.get("/api/shared/{token}")
async def get_shared_project(token: str):
    """Get project data via share token (Read-Only)"""
    link = await db.share_links.find_one({"token": token, "status": "active", "type": "view"})
    if not link:
        raise HTTPException(status_code=404, detail="Invalid or expired link")
        
    project = await db.projects.find_one({"_id": ObjectId(link["project_id"])})
    if not project:
         raise HTTPException(status_code=404, detail="Project not found")

    # Increment view count
    await db.share_links.update_one({"_id": link["_id"]}, {"$inc": {"views": 1}})

    # Filter data based on permissions
    # If specific files are allow-listed, only return those.
    # For now, we return basic project info.
    
    return {
        "project": {
            "id": str(project["_id"]),
            "name": project["name"],
            "icon": project.get("icon", ""),
            "status": project.get("status", "planning"),
            "tags": project.get("tags", []),
            "created_at": project["created_at"],
        },
        "permissions": link.get("permissions", {})
    }

@app.get("/api/shared/{token}/files")
async def list_shared_files(token: str):
    """List files allowed by share token"""
    link = await db.share_links.find_one({"token": token, "status": "active", "type": "view"})
    if not link:
        raise HTTPException(status_code=404, detail="Invalid link")
        
    permissions = link.get("permissions", {})
    allowed_files = permissions.get("allow_files", [])
    
    # If allow_files is empty or not present, maybe we show nothing? 
    # Or if "all" is specified? Let's assume explicit allow-list for now if present.
    # If allow_files is None, maybe allow all? Let's be restrictive: require explicit list or specific flag.
    
    query = {"project_id": link["project_id"]}
    if allowed_files:
        # Convert to ObjectIds
        ids = [ObjectId(fid) for fid in allowed_files if ObjectId.is_valid(fid)]
        query["_id"] = {"$in": ids}
    elif permissions.get("allow_all_files", False):
        pass # Allow all
    else:
        return [] # No files allowed
        
    files = []
    cursor = db.files.find(query).sort("priority", -1)
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

@app.post("/api/projects/{project_id}/invites")
async def create_invite(project_id: str, body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Create an invite link/token"""
    project = await db.projects.find_one({"_id": ObjectId(project_id), "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    email = body.get("email")
    
    token = secrets.token_urlsafe(16)
    invite = {
        "project_id": project_id,
        "created_by": current_user["id"],
        "token": token,
        "type": "invite",
        "target_email": email,
        "status": "active",
        "created_at": datetime.now()
    }
    
    await db.share_links.insert_one(invite)
    
    if email:
        # Add to pending invites on project
        await db.projects.update_one(
            {"_id": ObjectId(project_id)},
            {"$addToSet": {"pending_invites": email}}
        )
        
    return {"token": token, "url": f"/invite/{token}"}

@app.post("/api/invites/{token}/accept")
async def accept_invite(token: str, current_user: dict = Depends(get_current_user)):
    """Accept an invite token"""
    invite = await db.share_links.find_one({"token": token, "status": "active", "type": "invite"})
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid or expired invite")
        
    project_id = invite["project_id"]
    
    # Check if already collaborator
    project = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if current_user["id"] in project.get("collaborators", []):
         return {"detail": "Already a collaborator", "project_id": project_id}
         
    # Add to collaborators
    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {
            "$addToSet": {"collaborators": current_user["id"]},
            "$pull": {"pending_invites": current_user.get("email")} 
        }
    )
    
    # Clean up invite? (Optional, maybe keep for record)
    # await db.share_links.update_one({"_id": invite["_id"]}, {"$set": {"status": "accepted"}})
    
    return {"detail": "Joined project successfully", "project_id": project_id}

