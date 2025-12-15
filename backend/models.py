from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema, handler):
        json_schema = handler(core_schema)
        json_schema.update(type="string")
        return json_schema

class UserModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    email: EmailStr
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.now)

class ProjectModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    user_id: str
    status: str = "planning" 
    tags: List[str] = []
    created_at: datetime = Field(default_factory=datetime.now)
    last_edited: datetime = Field(default_factory=datetime.now)
    difficulty: str = "medium" # low, medium, high

class FileModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    project_id: str
    name: str
    type: str 
    category: str 
    content: str = ""
    priority: int = 5 # 1-10, 10 is highest
    created_at: datetime = Field(default_factory=datetime.now)
    last_edited: datetime = Field(default_factory=datetime.now)

class TaskModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    project_id: str
    title: str
    description: str = ""
    status: str = "todo" # todo, in-progress, done
    priority: str = "medium" # low, medium, high
    quadrant: str = "q2" # q1 (urgent-important), q2 (not-urgent-important), q3 (urgent-not-important), q4 (not-urgent-not-important)
    difficulty: str = "medium" # easy, medium, hard
    linked_files: List[str] = [] # List of file IDs
    due_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.now)

# Response Models
class UserResponse(BaseModel):
    id: str
    email: str

class ProjectResponse(BaseModel):
    id: str
    name: str
    status: str
    tags: List[str] = []
    created_at: datetime
    last_edited: datetime

class FileResponse(BaseModel):
    id: str
    project_id: str
    name: str
    type: str
    category: str
    content: str
    priority: int
    last_edited: datetime

class TaskResponse(BaseModel):
    id: str
    project_id: str
    title: str
    description: str
    status: str
    priority: str
    quadrant: str
    difficulty: str = "medium"
    linked_files: List[str]
    due_date: Optional[datetime]
    created_at: datetime
