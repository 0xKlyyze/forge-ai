import requests
import sys
import json
from datetime import datetime

class ForgeAPITester:
    def __init__(self, base_url="https://project-forge-55.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_project_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test basic API health"""
        success, response = self.run_test(
            "API Health Check",
            "GET",
            "",
            200
        )
        return success

    def test_register(self, email, password):
        """Test user registration"""
        success, response = self.run_test(
            "User Registration",
            "POST",
            "api/auth/register",
            200,
            data={"email": email, "password_hash": password}
        )
        if success and 'id' in response:
            self.user_id = response['id']
            print(f"   User ID: {self.user_id}")
        return success

    def test_login(self, email, password):
        """Test login and get token"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "api/auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   Token received: {self.token[:20]}...")
            return True
        return False

    def test_create_project(self, name):
        """Create a project"""
        success, response = self.run_test(
            "Create Project",
            "POST",
            "api/projects",
            200,
            data={"name": name, "user_id": self.user_id or "temp"}
        )
        if success and 'id' in response:
            self.created_project_id = response['id']
            print(f"   Project ID: {self.created_project_id}")
        return success, response

    def test_list_projects(self):
        """List user projects"""
        success, response = self.run_test(
            "List Projects",
            "GET",
            "api/projects",
            200
        )
        return success, response

    def test_get_project(self, project_id):
        """Get specific project"""
        success, response = self.run_test(
            "Get Project",
            "GET",
            f"api/projects/{project_id}",
            200
        )
        return success, response

    def test_list_files(self, project_id):
        """List files in project"""
        success, response = self.run_test(
            "List Project Files",
            "GET",
            f"api/projects/{project_id}/files",
            200
        )
        return success, response

    def test_create_file(self, project_id, name, category, file_type, content):
        """Create a file in project"""
        success, response = self.run_test(
            "Create File",
            "POST",
            "api/files",
            200,
            data={
                "project_id": project_id,
                "name": name,
                "category": category,
                "type": file_type,
                "content": content
            }
        )
        return success, response

    def test_update_file(self, file_id, content):
        """Update file content"""
        success, response = self.run_test(
            "Update File",
            "PUT",
            f"api/files/{file_id}",
            200,
            data={"content": content}
        )
        return success, response

    def test_delete_project(self, project_id):
        """Delete a project"""
        success, response = self.run_test(
            "Delete Project",
            "DELETE",
            f"api/projects/{project_id}",
            200
        )
        return success, response

    def test_list_tasks(self, project_id):
        """List tasks in project"""
        success, response = self.run_test(
            "List Project Tasks",
            "GET",
            f"api/projects/{project_id}/tasks",
            200
        )
        return success, response

    def test_create_task(self, project_id, title, status="todo", priority="high", quadrant="q1"):
        """Create a task in project"""
        success, response = self.run_test(
            "Create Task",
            "POST",
            "api/tasks",
            200,
            data={
                "project_id": project_id,
                "title": title,
                "status": status,
                "priority": priority,
                "quadrant": quadrant
            }
        )
        return success, response

    def test_update_task(self, task_id, updates):
        """Update task"""
        success, response = self.run_test(
            "Update Task",
            "PUT",
            f"api/tasks/{task_id}",
            200,
            data=updates
        )
        return success, response

    def test_delete_task(self, task_id):
        """Delete a task"""
        success, response = self.run_test(
            "Delete Task",
            "DELETE",
            f"api/tasks/{task_id}",
            200
        )
        return success, response

def main():
    # Setup
    tester = ForgeAPITester()
    test_email = f"test@example.com"
    test_password = "password123"
    
    print("🚀 Starting Forge API Tests")
    print("=" * 50)

    # Test 1: Health Check
    if not tester.test_health_check():
        print("❌ API is not responding, stopping tests")
        return 1

    # Test 2: Registration
    if not tester.test_register(test_email, test_password):
        print("❌ Registration failed, stopping tests")
        return 1

    # Test 3: Login
    if not tester.test_login(test_email, test_password):
        print("❌ Login failed, stopping tests")
        return 1

    # Test 4: Create Project
    success, project_data = tester.test_create_project("Genesis")
    if not success:
        print("❌ Project creation failed, stopping tests")
        return 1

    # Test 5: List Projects
    success, projects = tester.test_list_projects()
    if not success:
        print("❌ Project listing failed")
        return 1
    else:
        print(f"   Found {len(projects)} projects")

    # Test 6: Get Specific Project
    if tester.created_project_id:
        success, project = tester.test_get_project(tester.created_project_id)
        if not success:
            print("❌ Get project failed")

    # Test 7: List Files (should have default templates)
    if tester.created_project_id:
        success, files = tester.test_list_files(tester.created_project_id)
        if success:
            print(f"   Found {len(files)} default files")
            # Check for default templates
            doc_files = [f for f in files if f.get('category') == 'Docs']
            print(f"   Docs category has {len(doc_files)} files")
            
            # Look for Project-Overview.md
            overview_file = next((f for f in files if 'Project-Overview' in f.get('name', '')), None)
            if overview_file:
                print(f"   ✅ Found default template: {overview_file['name']}")
            else:
                print(f"   ❌ Project-Overview.md template not found")

    # Test 8: Create New File
    created_file_id = None
    if tester.created_project_id:
        success, file_data = tester.test_create_file(
            tester.created_project_id,
            "Counter.jsx",
            "Mockups",
            "mockup",
            "import React, { useState } from 'react';\n\nfunction Counter() {\n  const [count, setCount] = useState(0);\n  return (\n    <div>\n      <p>Count: {count}</p>\n      <button onClick={() => setCount(count + 1)}>+</button>\n    </div>\n  );\n}\n\nexport default Counter;"
        )
        if success and 'id' in file_data:
            created_file_id = file_data['id']
            print(f"   Created file ID: {created_file_id}")

    # Test 9: Update File Content
    if created_file_id:
        new_content = "import React, { useState } from 'react';\n\nfunction Counter() {\n  const [count, setCount] = useState(0);\n  return (\n    <div className='counter'>\n      <h2>Simple Counter</h2>\n      <p>Count: {count}</p>\n      <button onClick={() => setCount(count + 1)}>Increment</button>\n      <button onClick={() => setCount(count - 1)}>Decrement</button>\n    </div>\n  );\n}\n\nexport default Counter;"
        
        success, _ = tester.test_update_file(created_file_id, new_content)
        if success:
            print("   ✅ File content updated successfully")

    # Test 10: Delete Project (cleanup)
    if tester.created_project_id:
        success, _ = tester.test_delete_project(tester.created_project_id)
        if success:
            print("   ✅ Project deleted successfully")

    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Tests completed: {tester.tests_passed}/{tester.tests_run}")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())