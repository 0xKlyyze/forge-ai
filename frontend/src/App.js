import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './authContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ProjectLayout from './pages/Project/Layout';
import ProjectHome from './pages/Project/Home';
import Workspace from './pages/Workspace';
import ProjectTasks from './pages/Project/Tasks';
import ProjectFiles from './pages/Project/Files';
import ProjectSettings from './pages/Project/Settings'; // Import Settings
import ProjectChat from './pages/Project/Chat';
import ProjectOnboarding from './pages/Project/Onboarding';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="text-white">Loading...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  return children;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Layout>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />

            <Route
              path="/project/:projectId/onboarding"
              element={
                <PrivateRoute>
                  <ProjectOnboarding />
                </PrivateRoute>
              }
            />

            <Route
              path="/project/:projectId"
              element={
                <PrivateRoute>
                  <ProjectLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<Navigate to="home" replace />} />
              <Route path="home" element={<ProjectHome />} />
              <Route path="chat" element={<ProjectChat />} />
              <Route path="files" element={<ProjectFiles />} />
              <Route path="editor" element={<Workspace />} />
              <Route path="editor/:fileId" element={<Workspace />} />
              <Route path="tasks" element={<ProjectTasks />} />
              <Route path="settings" element={<ProjectSettings />} /> {/* Added Route */}
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </Router>
  );
}

export default App;
