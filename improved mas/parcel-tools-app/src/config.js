// Where the local Parcel Tools backend (the Python engine) listens.
// Every screen takes the address from here, so a port change is a one-line edit.
export const BACKEND_PORT = 5000;
export const API_BASE_URL = `http://localhost:${BACKEND_PORT}`;
// The same backend by IP address, used by the start-up checks (login, license)
export const API_LOOPBACK_URL = `http://127.0.0.1:${BACKEND_PORT}`;
