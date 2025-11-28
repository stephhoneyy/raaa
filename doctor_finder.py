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

    matches = [
        {
            "title": item["title"],
            "description": f"{item['description']} (Located in {item['suburb']})",
            "link": item["link"]
        }
        for item in MOCK_DOCTOR_DIRECTORY if specialty in item["specialty"]
    ]

    return matches[:3] if matches else [
        {
            "title": "General Practice Clinic",
            "description": f"No exact match for {specialty}. Showing nearest GP options.",
            "link": "https://example.com/gp"
        }
    ]