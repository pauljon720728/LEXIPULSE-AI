const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api").replace(/\/$/, "");

export async function apiRequest(endpoint, method = "GET", body = null, customHeaders = {}) {
  const token = localStorage.getItem("legal_jwt_token");
  const headers = {
    "Content-Type": "application/json",
    ...customHeaders,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Request failed with status ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

export function downloadPdfUrl(complaintId) {
  return `${API_BASE_URL}/complaints/${complaintId}/pdf`;
}

export function exportCsvUrl() {
  return `${API_BASE_URL}/admin/export/csv`;
}
