import requests
import secrets
import sys

BASE_URL = "http://localhost:8001" # Ensure port matches running server (8001 seen in context)

# Colors
GREEN = "\033[92m"
RED = "\033[91m"
RESET = "\033[0m"

def log(msg, success=True):
    color = GREEN if success else RED
    print(f"{color}[{'OK' if success else 'FAIL'}] {msg}{RESET}")

def verify_permissions():
    session = requests.Session()

    # 1. Login
    email = f"user_{secrets.token_hex(4)}@test.com"
    pwd = "password123"
    print(f"Creating User: {email}")
    
    res = session.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password_hash": pwd})
    res = session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pwd})
    if res.status_code != 200:
        log("Login failed", False)
        return
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Create Project
    print("Creating Project...")
    res = session.post(f"{BASE_URL}/api/projects", json={"name": "Perm Test Project"}, headers=headers)
    project_id = res.json()["id"]
    log(f"Project Created: {project_id}")

    # 3. Create Files
    print("Creating Files...")
    # Fix: Endpoint is /api/files and project_id must be in body
    res = session.post(f"{BASE_URL}/api/files", json={"project_id": project_id, "name": "File A", "type": "doc", "category": "docs"}, headers=headers)
    if res.status_code != 200:
        log(f"Create File A Failed: {res.text}", False)
        return
    file_a_id = res.json()["id"]
    
    res = session.post(f"{BASE_URL}/api/files", json={"project_id": project_id, "name": "File B", "type": "doc", "category": "docs"}, headers=headers)
    if res.status_code != 200:
        log(f"Create File B Failed: {res.text}", False)
        return
    file_b_id = res.json()["id"]
    log(f"Files Created: {file_a_id}, {file_b_id}")

    # 4. Generate Share Link (Allow only File A)
    print("Generating Link (File A Only)...")
    permissions = {
        "allow_pages": ["home", "files"],
        "allow_all_files": False,
        "allow_files": [file_a_id]
    }
    res = session.post(f"{BASE_URL}/api/projects/{project_id}/share", json=permissions, headers=headers)
    share_token = res.json()["token"]
    log(f"Share Token: {share_token}")

    # 5. Verify API Response
    print("Verifying List Files via Public Link...")
    res = requests.get(f"{BASE_URL}/api/shared/{share_token}/files")
    files = res.json()
    
    file_ids = [f["id"] for f in files]
    if file_a_id in file_ids and file_b_id not in file_ids:
        log("Permissions Verified: Only File A returned")
        log(f"Returned: {file_ids}")
    else:
        log(f"Permissions FAIL. Returned: {file_ids}", False)

    # 6. Verify Permissions Object in Metadata
    print("Verifying Metadata...")
    res = requests.get(f"{BASE_URL}/api/shared/{share_token}")
    data = res.json()
    perms = data["permissions"]
    if perms["allow_files"] == [file_a_id] and not perms["allow_all_files"]:
        log("Metadata OK")
    else:
        log(f"Metadata FAIL: {perms}", False)

if __name__ == "__main__":
    try:
        verify_permissions()
    except Exception as e:
        log(f"Test Crashed: {e}", False)
