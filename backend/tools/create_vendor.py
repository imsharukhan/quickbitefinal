import requests
import getpass
import os
import sys

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")

print("=== QuickBite - Create Vendor Account ===")
print(f"Connecting to: {BASE_URL}")
print()

name = input("Vendor Name: ").strip()
phone = input("Phone Number: ").strip()
initial_password = getpass.getpass("Initial Password (hidden): ")
admin_key = getpass.getpass("Admin Key (hidden): ")

if not all([name, phone, initial_password, admin_key]):
    print("Error: All fields are required")
    sys.exit(1)

try:
    response = requests.post(
        f"{BASE_URL}/api/admin/vendors",
        json={"name": name, "phone": phone, "initial_password": initial_password},
        headers={"X-Admin-Key": admin_key}
    )
    if response.status_code in [200, 201]:
        print()
        print("Vendor created successfully!")
        print(f"Name: {name}")
        print(f"Phone: {phone}")
        print(f"Temporary Password: {initial_password}")
        print("Vendor must change password on first login")
    else:
        print(f"Error: {response.json().get('detail', 'Unknown error')}")
except Exception as e:
    print(f"Connection error: {e}")
