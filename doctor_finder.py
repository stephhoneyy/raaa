# doctor_directory_victoria.py

MOCK_DOCTOR_DIRECTORY = [
    {
        "specialty": "physiotherapy",
        "suburb": "Richmond",
        "postcode": "3121",
        "title": "Richmond Sports & Physio Clinic",
        "description": "Sports injury specialists offering neuro and musculoskeletal rehabilitation. NDIS registered.",
        "link": "https://example.com/richmond-physio"
    },
    {
        "specialty": "physiotherapy",
        "suburb": "Fitzroy",
        "postcode": "3065",
        "title": "Fitzroy Physiotherapy Centre",
        "description": "Experienced team providing post-operative, neuro, and paediatric physio services.",
        "link": "https://example.com/fitzroy-physio"
    },
    {
        "specialty": "cardiology",
        "suburb": "Parkville",
        "postcode": "3052",
        "title": "Melbourne Heart Group",
        "description": "Comprehensive cardiology care including ECG, stress tests, and heart failure management.",
        "link": "https://example.com/melbourne-heart"
    },
    {
        "specialty": "cardiology",
        "suburb": "Box Hill",
        "postcode": "3128",
        "title": "Eastern Cardiology Specialists",
        "description": "Cardiology team offering diagnostic imaging, arrhythmia management, and cardiac rehab.",
        "link": "https://example.com/eastern-cardiology"
    },
    {
        "specialty": "psychiatry",
        "suburb": "St Kilda",
        "postcode": "3182",
        "title": "St Kilda Mental Health & Psychiatry",
        "description": "Adult and youth mental health services with focus on anxiety, mood disorders, and ADHD.",
        "link": "https://example.com/stkilda-psychiatry"
    },
    {
        "specialty": "psychiatry",
        "suburb": "Footscray",
        "postcode": "3011",
        "title": "Western Behavioural Health Clinic",
        "description": "Multidisciplinary mental health clinic offering psychiatry, psychology, and counselling.",
        "link": "https://example.com/western-behavioural"
    },
    {
        "specialty": "endocrinology",
        "suburb": "Carlton",
        "postcode": "3053",
        "title": "Carlton Endocrine & Diabetes Centre",
        "description": "Diabetes, thyroid, osteoporosis and hormone disorder management.",
        "link": "https://example.com/carlton-endocrine"
    },
    {
        "specialty": "endocrinology",
        "suburb": "Bentleigh",
        "postcode": "3204",
        "title": "South East Endocrinology Clinic",
        "description": "Specialists in metabolic bone disease, diabetes care and hormonal conditions.",
        "link": "https://example.com/bentleigh-endocrinology"
    },
    {
        "specialty": "oncology",
        "suburb": "Heidelberg",
        "postcode": "3084",
        "title": "Austin Oncology Unit",
        "description": "Comprehensive cancer care including chemotherapy, immunotherapy, and diagnostic imaging.",
        "link": "https://example.com/austin-oncology"
    },
    {
        "specialty": "oncology",
        "suburb": "Clayton",
        "postcode": "3168",
        "title": "Monash Cancer Centre",
        "description": "Integrated cancer treatment centre with radiology, chemotherapy, and clinical trials.",
        "link": "https://example.com/monash-cancer"
    }
]


def find_nearby_doctors(specialty: str, postcode: str):
    specialty = specialty.lower()

    # Find exact matches first
    results = [
        clinic for clinic in MOCK_DOCTOR_DIRECTORY
        if clinic["specialty"] == specialty
    ]

    # Optional: filter again by postcode proximity (simple string compare)
    if postcode:
        filtered_by_postcode = [
            c for c in results if c["postcode"] == postcode
        ]
        if filtered_by_postcode:
            results = filtered_by_postcode

    # Fallback generic
    if not results:
        return [{
            "title": f"{specialty.title()} Clinic near {postcode}",
            "description": f"No exact matches found — showing nearest available {specialty} clinic.",
            "link": "https://example.com/nearby-specialist"
        }]

    # Convert to frontend shape
    return [
        {
            "title": clinic["title"],
            "description": f"{clinic['description']} Located in {clinic['suburb']} ({clinic['postcode']}).",
            "link": clinic["link"]
        }
        for clinic in results
    ]
