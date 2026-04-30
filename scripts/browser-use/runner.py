import asyncio
import os
import sys
import json
from dotenv import load_dotenv
from browser_use import Agent
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI

# Load environment variables from .env.local in the root if it exists
root_env = os.path.join(os.getcwd(), '.env.local')
if os.path.exists(root_env):
    load_dotenv(root_env)
else:
    load_dotenv()

async def run_task(task_text):
    # Choose LLM based on available keys
    if os.getenv("OPENAI_API_KEY"):
        llm = ChatOpenAI(model="gpt-4o")
    elif os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"):
        llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash-exp")
    else:
        print(json.dumps({"ok": False, "error": "No API key found for OpenAI or Google."}))
        return

    agent = Agent(
        task=task_text,
        llm=llm,
    )
    
    try:
        result = await agent.run()
        # Extract the final result summary
        summary = result.final_result() if hasattr(result, 'final_result') else str(result)
        
        print(json.dumps({
            "ok": True,
            "summary": summary,
            "status": "completed"
        }))
    except Exception as e:
        print(json.dumps({
            "ok": False,
            "error": str(e),
            "status": "failed"
        }))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        task = sys.argv[1]
    else:
        # Read from stdin
        try:
            input_data = sys.stdin.read().strip()
            if not input_data:
                print(json.dumps({"ok": False, "error": "No task provided."}))
                sys.exit(1)
            task = input_data
        except EOFError:
            print(json.dumps({"ok": False, "error": "No task provided."}))
            sys.exit(1)
            
    asyncio.run(run_task(task))
