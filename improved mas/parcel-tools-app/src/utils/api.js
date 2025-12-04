import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Health check
export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

// Area calculation
export const calculateArea = async (points) => {
  const response = await api.post('/calculate-area', { points });
  return response.data;
};

// Projects
export const getProjects = async () => {
  const response = await api.get('/projects');
  return response.data;
};

export const createProject = async (projectData) => {
  const response = await api.post('/projects', projectData);
  return response.data;
};

export const getProject = async (projectId) => {
  const response = await api.get(`/projects/${projectId}`);
  return response.data;
};

export const updateProject = async (projectId, projectData) => {
  const response = await api.put(`/projects/${projectId}`, projectData);
  return response.data;
};

export const deleteProject = async (projectId) => {
  const response = await api.delete(`/projects/${projectId}`);
  return response.data;
};

// Points import/export
export const importPoints = async (textData) => {
  const response = await api.post('/import-points', { data: textData });
  return response.data;
};

export const exportPoints = async (points) => {
  const response = await api.post('/export-points', { points });
  return response.data;
};

// Assistant
export const askAssistant = async ({ messages }) => {
  const response = await api.post('/ai/ask', { messages });
  return response.data;
};

export const getAiConfig = async () => {
  const response = await api.get('/ai/config');
  return response.data;
};

export const saveAiConfig = async ({ openai_api_key, model }) => {
  const response = await api.post('/ai/config', { openai_api_key, model });
  return response.data;
};

// Recent Files
export const getRecentFiles = async () => {
  const response = await api.get('/recent-files');
  return response.data;
};

export const addRecentFile = async ({ type, path, name, metadata }) => {
  const response = await api.post('/recent-files', { type, path, name, metadata });
  return response.data;
};

export const clearRecentFiles = async (type = null) => {
  const response = await api.post('/recent-files/clear', type ? { type } : {});
  return response.data;
};

export default api;


