from heidi_session_mock import get_location_and_specialties_for_session

def extract_from_session():
    """
    Calls your Heidi helper to extract:
    - specialties list
    - location dict containing postcode
    
    Returns: (specialty, postcode)
    """
    data = get_location_and_specialties_for_session()

    specialties = data.get("specialties", [])
    location = data.get("location", {})

    specialty = specialties[0] if specialties else "general practice"
    postcode = location.get("postcode", "3000")

    return specialty, postcode
