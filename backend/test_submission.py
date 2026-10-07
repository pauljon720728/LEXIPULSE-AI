import requests
import json

payload = {
    "raw_text": "Mere bank account se 50000 rupees cyber fraud me chale gaye aur call karne par gaaliyan de rahe hain. Kripya turant sahayata karein!",
    "citizen_name": "Ramesh Kumar",
    "citizen_contact": "+91 98765 43210",
    "citizen_email": "ramesh@example.com",
    "preferred_model_mode": "transformer"
}

try:
    res = requests.post("http://127.0.0.1:8000/complaints/submit", json=payload)
    print("STATUS CODE:", res.status_code)
    data = res.json()
    print("RESPONSE JSON:")
    print(json.dumps(data, indent=2))
except Exception as e:
    print("ERROR:", e)
