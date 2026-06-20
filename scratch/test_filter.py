import sys
import os

# server/ dizinini yola ekle
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../server')))

from server import is_offensive

def run_tests():
    # Test cases: (input_text, expected_is_offensive)
    tests = [
        # Normal words
        ("Harika Bölüm", False),
        ("Sıkıntı Yok", False), # 'sik' substring check shouldn't trigger on 'sıkıntı'
        ("Tasarımcı 1", False),
        ("Labirent Macerası", False),
        ("Neon sewer", False),

        # Profanities / Slang (Short)
        ("amk", True),
        ("aq", True),
        ("sik", True),
        ("got", True),
        ("oc", True),

        # Profanities / Slang (Long)
        ("yarrak", True),
        ("yarak", True),
        ("orospu çocuğu", True),
        ("siktir git", True),
        ("pezevenk", True),
        ("amcık", True),

        # Political terms
        ("akp", True),
        ("chp", True),
        ("mhp", True),
        ("hdp", True),
        ("rte", True),
        ("erdogan", True),
        ("erdoğan", True),
        ("kilicdaroglu", True),
        ("kılıçdaroğlu", True),
        ("imamoglu", True),
        ("imamoğlu", True),
        ("ataturk", True),
        ("atatürk", True),
        ("pkk", True),
        ("feto", True),
        ("fetö", True),

        # Fuzzy / Bypass attempts
        ("p.k.k", True), # punctuation removed
        ("ErDoGaN", True), # case insensitivity
        ("yArRaK", True), # case insensitivity
        ("şiktir", True), # turkish character variation
        ("pkk_sektörü", True), # substring match inside word
        ("kılıçdaroğlu_fan", True),

        # Newly requested terms
        ("am", True),
        ("göt", True),
        ("meme", True),
        ("yarrak", True),
        ("siken", True),
        ("domaltan", True),
        ("domaltma", True),
        ("domaltan_harita", True),
        ("siken_tasarimci", True),
        ("a.m", True),
        ("g.ö.t", True),
        ("m.e.m.e", True),
    ]

    passed = 0
    failed = 0

    for text, expected in tests:
        res = is_offensive(text)
        if res == expected:
            passed += 1
            print(f"[PASS] '{text}' -> expected {expected}, got {res}")
        else:
            failed += 1
            print(f"[FAIL] '{text}' -> expected {expected}, got {res}")

    print(f"\nTest Summary: {passed} passed, {failed} failed.")
    return failed == 0

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
