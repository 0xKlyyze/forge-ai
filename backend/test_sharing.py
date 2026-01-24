import requests
import secrets
import sys

BASE_URL = "http://localhost:8000"

# Colors
GREEN = "\033[92m"
RED = "\033[91m"
RESET = "\033[0m"

def log(msg, success=True):
    color = GREEN if success else RED
    print(f"{color}[{'OK' if success else 'FAIL'}] {msg}{RESET}")

def test_flow():
    session = requests.Session()
    session2 = requests.Session()

    # 1. Register/Login User A (Owner)
    email_a = f"owner_{secrets.token_hex(4)}@test.com"
    pwd = "password123"
    print(f"Creating Owner: {email_a}")
    
    res = session.post(f"{BASE_URL}/api/auth/register", json={"email": email_a, "password_hash": pwd})
    if res.status_code != 200:
        # Maybe already exists, try login
        pass
    
    # Login A
    res = session.post(f"{BASE_URL}/api/auth/login", json={"email": email_a, "password": pwd})
    if res.status_code != 200:
        log("Login Owner failed", False)
        return
    token_a = res.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    
    # 2. Register/Login User B (Collaborator)
    email_b = f"collab_{secrets.token_hex(4)}@test.com"
    print(f"Creating Collaborator: {email_b}")
    res = session2.post(f"{BASE_URL}/api/auth/register", json={"email": email_b, "password_hash": pwd})
    
    # Login B
    res = session2.post(f"{BASE_URL}/api/auth/login", json={"email": email_b, "password": pwd})
    if res.status_code != 200:
        log("Login Collaborator failed", False)
        return
    token_b = res.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 3. Create Project as A
    print("Creating Project...")
    res = session.post(f"{BASE_URL}/api/projects", json={"name": "Shared Project Class", "icon": ""}, headers=headers_a)
    if res.status_code != 200:
        log(f"Create Project failed: {res.text}", False)
        return
    project_id = res.json()["id"]
    log(f"Project Created: {project_id}")

    # 4. Create Public Link
    print("Generating Public Link...")
    res = session.post(f"{BASE_URL}/api/projects/{project_id}/share", json={"allow_all_files": True}, headers=headers_a)
    if res.status_code != 200:
        log(f"Share failed: {res.text}", False)
        return
    share_token = res.json()["token"]
    log(f"Share Token: {share_token}")

    # 5. Verify Public Link Access (No Auth)
    print("Verifying Public Access...")
    res = requests.get(f"{BASE_URL}/api/shared/{share_token}")
    if res.status_code == 200 and res.json()["project"]["id"] == project_id:
        log("Public Access OK")
    else:
        log("Public Access Failed", False)

    # 6. Invite User B
    print("Inviting User B...")
    res = session.post(f"{BASE_URL}/api/projects/{project_id}/invites", json={"email": email_b}, headers=headers_a)
    if res.status_code != 200:
        log(f"Invite failed: {res.text}", False)
        return
    invite_token = res.json()["token"]
    log(f"Invite Token: {invite_token}")

    # 7. Accept Invite as User B
    print("User B Accepting Invite...")
    res = session2.post(f"{BASE_URL}/api/invites/{invite_token}/accept", headers=headers_b)
    if res.status_code == 200:
        log("Invite Accepted OK")
    else:
        log(f"Accept Invite Failed: {res.text}", False)

    # 8. Verify Access for User B
    print("Verifying Project in User B List...")
    res = session2.get(f"{BASE_URL}/api/projects", headers=headers_b)
    projects = res.json()
    if any(p["id"] == project_id for p in projects):
        log("Project found in Collaborator list")
    else:
        log("Project NOT found in Collaborator list", False)

    # 9. Verify Edit Access (User B updates project)
    print("Verifying Edit Access...")
    res = session2.put(f"{BASE_URL}/api/projects/{project_id}", json={"tags": ["collab-tag"]}, headers=headers_b)
    if res.status_code == 200 and "collab-tag" in res.json()["tags"]:
        log("Collaborator Edit OK")
    else:
        log(f"Collaborator Edit Failed: {res.status_code}", False)

if __name__ == "__main__":
    try:
        test_flow()
    except Exception as e:
        log(f"Test Crashed: {e}", False)
