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
    status: str = "planning" # planning, building, paused, complete
    created_at: datetime = Field(default_factory=datetime.now)
    last_edited: datetime = Field(default_factory=datetime.now)

class FileModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    project_id: str
    name: str
    type: str # doc, mockup, asset, other
    category: str # Docs, Mockups, Assets, Other
    content: str = ""
    created_at: datetime = Field(default_factory=datetime.now)
    last_edited: datetime = Field(default_factory=datetime.now)

# Response Models (hiding internal fields if necessary)
class UserResponse(BaseModel):
    id: str
    email: str

class ProjectResponse(BaseModel):
    id: str
    name: str
    status: str
    created_at: datetime
    last_edited: datetime

class FileResponse(BaseModel):
    id: str
    project_id: str
    name: str
    type: str
    category: str
    content: str
    last_edited: datetime
