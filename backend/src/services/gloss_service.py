GLOSS_TO_TEXT_RULES = {
    ("HELLO",): "Hello",
    ("HELLO", "NAME", "WHAT"): "Hello, what is your name?",
    ("THANK", "YOU"): "Thank you",
    ("THANK YOU",): "Thank you",
    ("HELP", "NEED"): "I need help",
    ("HELP",): "Help",
    ("DOCTOR", "NEED"): "I need a doctor",
    ("EMERGENCY",): "This is an emergency",
    ("YES",): "Yes",
    ("NO",): "No",
    ("PLEASE",): "Please",
    ("SORRY",): "I'm sorry",
    ("GOODBYE",): "Goodbye",
    ("BYE",): "Goodbye",
    ("WANT",): "I want",
    ("NEED",): "I need",
    ("UNDERSTAND",): "I understand",
    ("NAME",): "Name",
    ("WHAT",): "What?",
    ("WHERE",): "Where?",
    ("WHEN",): "When?",
    ("WHO",): "Who?",
    ("HOW",): "How?",
    ("WHY",): "Why?",
    ("PAIN",): "I'm in pain",
    ("HOSPITAL",): "Hospital",
    ("WATER",): "Water",
    ("FOOD",): "Food",
    ("EAT",): "Eat",
    ("DRINK",): "Drink",
}


def gloss_to_text(gloss_sequence: list[str]) -> str:
    key = tuple(gloss_sequence)
    if key in GLOSS_TO_TEXT_RULES:
        return GLOSS_TO_TEXT_RULES[key]

    # Fallback: join glosses with spaces
    return " ".join(word.capitalize() for word in gloss_sequence)