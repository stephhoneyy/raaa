def capitalize(s: str) -> str:
    return s[:1].upper() + s[1:] if s else s

def find_nearby_doctors(specialty: str, location: str):
    spec = capitalize(specialty or "specialist")
    loc = location or "nearby"

    return [
        {
            "title": f"{loc} {spec} Clinic",
            "description": f"Experienced {spec.lower()}s near {loc}. Accepts Medicare and private health.",
            "link": "https://example.com/clinic1"
        },
        {
            "title": f"Eastern Suburbs {spec} Centre",
            "description": f"Multidisciplinary team working with {spec}s. Approx 3.5 km from {loc}.",
            "link": "https://example.com/clinic2"
        }
    ]
