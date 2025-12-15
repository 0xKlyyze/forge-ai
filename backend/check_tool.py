import google.generativeai as genai
try:
    print("Checking Tool fields...")
    # Try to instantiate with google_search
    try:
        t = genai.protos.Tool(google_search=genai.protos.GoogleSearchRetrieval())
        print("Success: Tool accepts google_search with GoogleSearchRetrieval")
    except Exception as e:
        print(f"Failed with GoogleSearchRetrieval: {e}")

    try:
        # Check if GoogleSearch exists
        if hasattr(genai.protos, 'GoogleSearch'):
             t = genai.protos.Tool(google_search=genai.protos.GoogleSearch())
             print("Success: Tool accepts google_search with GoogleSearch")
        else:
             print("genai.protos.GoogleSearch does not exist")
    except Exception as e:
         print(f"Failed with GoogleSearch: {e}")

except Exception as e:
    print(f"General Error: {e}")
